"""Proprietary rush score prediction engine.

Combines reservation counts, check-ins, historical data, and daily SERP snapshots
to forecast restaurant busyness without relying on Google Popular Times in real-time.

Forecasts run after the 1pm PKT SERP scrape and stay live until restaurant closing.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CheckIn, Reservation, ReservationStatus, RushHistory, RushLevel, SerpTrafficSnapshot

PKT = ZoneInfo("Asia/Karachi")
FORECAST_START_HOUR = 13  # 1pm PKT anchor


def now_pkt() -> datetime:
    return datetime.now(PKT)


def rush_level_from_percentage(pct: float) -> RushLevel:
    """Map rush percentage to human-readable level."""
    if pct < 25:
        return RushLevel.QUIET
    if pct < 50:
        return RushLevel.MODERATE
    if pct < 75:
        return RushLevel.BUSY
    return RushLevel.VERY_BUSY


def estimate_wait_minutes(rush_pct: float, party_size: int = 2) -> int:
    """Estimate wait time from rush percentage and party size."""
    base_wait = rush_pct * 0.6
    party_factor = 1 + (party_size - 2) * 0.15
    return max(0, int(base_wait * party_factor))


def parse_closing_hour(opening_hours: dict | None, dow: int) -> int:
    """Return closing hour in PKT (may exceed 23 for after-midnight close)."""
    if not opening_hours:
        return 23

    day_key = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][dow]
    day_data = opening_hours.get(day_key, {})
    if not isinstance(day_data, dict):
        return 23

    if day_data.get("open") is False:
        return FORECAST_START_HOUR

    to_time = str(day_data.get("to", "23:00"))
    try:
        hour = int(to_time.split(":")[0])
    except ValueError:
        return 23

    # e.g. closes at 01:00 → hour 25 for forecast loop
    if hour <= 6:
        return hour + 24
    return hour


def forecast_hour_range(opening_hours: dict | None, dow: int) -> range:
    """Hours to forecast from 1pm PKT until closing."""
    closing = parse_closing_hour(opening_hours, dow)
    start = FORECAST_START_HOUR
    end = max(start, closing)
    return range(start, end + 1)


async def get_serp_forecast_for_hour(
    db: AsyncSession,
    restaurant_id: str,
    hour: int,
    dow: int,
) -> RushHistory | None:
    """Latest SERP forecast row for the current PKT hour today."""
    today = now_pkt().date()
    today_start = datetime.combine(today, datetime.min.time())
    return await db.scalar(
        select(RushHistory)
        .where(
            RushHistory.restaurant_id == restaurant_id,
            RushHistory.source == "serp_forecast",
            RushHistory.hour_of_day == hour,
            RushHistory.day_of_week == dow,
            RushHistory.recorded_at >= today_start,
        )
        .order_by(RushHistory.recorded_at.desc())
        .limit(1)
    )


async def get_current_rush(
    db: AsyncSession,
    restaurant_id: str,
    party_size: int = 2,
    opening_hours: dict | None = None,
) -> dict:
    """Calculate current rush score for a restaurant."""
    now = now_pkt()
    hour = now.hour
    dow = now.weekday()
    before_forecast = hour < FORECAST_START_HOUR

    serp_forecast = None
    if not before_forecast:
        serp_forecast = await get_serp_forecast_for_hour(db, restaurant_id, hour, dow)

    if serp_forecast:
        rush_pct = float(serp_forecast.rush_percentage)
        wait = serp_forecast.estimated_wait_minutes or estimate_wait_minutes(rush_pct, party_size)
        level = serp_forecast.rush_level or rush_level_from_percentage(rush_pct)
        return {
            "rush_percentage": round(rush_pct, 1),
            "estimated_wait_minutes": wait,
            "confidence_score": float(serp_forecast.confidence_score or 0.75),
            "rush_level": level,
            "forecast_live": True,
            "forecast_starts_at": "13:00 PKT",
        }

    # Fallback: composite score before 1pm or when no SERP forecast exists
    res_count = await db.scalar(
        select(func.count(Reservation.id)).where(
            Reservation.restaurant_id == restaurant_id,
            Reservation.reservation_date == now.date(),
            Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
        )
    ) or 0

    checkin_count = await db.scalar(
        select(func.count(CheckIn.id)).where(
            CheckIn.restaurant_id == restaurant_id,
            CheckIn.checked_out_at.is_(None),
            CheckIn.checked_in_at >= now.replace(tzinfo=None) - timedelta(hours=3),
        )
    ) or 0

    serp = await db.scalar(
        select(SerpTrafficSnapshot)
        .where(SerpTrafficSnapshot.restaurant_id == restaurant_id)
        .order_by(SerpTrafficSnapshot.scraped_at.desc())
        .limit(1)
    )

    hist = await db.scalar(
        select(func.avg(RushHistory.rush_percentage)).where(
            RushHistory.restaurant_id == restaurant_id,
            RushHistory.hour_of_day == hour,
            RushHistory.day_of_week == dow,
        )
    )

    serp_hour_pop = 50.0
    if serp and serp.popular_times:
        day_key = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][dow]
        day_data = serp.popular_times.get(day_key, [])
        if isinstance(day_data, list) and len(day_data) > hour:
            serp_hour_pop = float(day_data[hour] or 50)
        elif serp.current_popularity:
            serp_hour_pop = float(serp.current_popularity)

    reservation_weight = min(res_count * 8, 30)
    checkin_weight = min(checkin_count * 5, 25)
    serp_weight = serp_hour_pop * 0.35 if not before_forecast else serp_hour_pop * 0.15
    hist_weight = float(hist or 40) * 0.25

    rush_pct = min(100, reservation_weight + checkin_weight + serp_weight + hist_weight)
    confidence = 0.35 if before_forecast else 0.4
    if serp and not before_forecast:
        confidence += 0.25
    if hist:
        confidence += 0.15
    if res_count > 0 or checkin_count > 0:
        confidence += 0.15
    confidence = min(confidence, 0.95)

    wait = estimate_wait_minutes(rush_pct, party_size)
    level = rush_level_from_percentage(rush_pct)

    return {
        "rush_percentage": round(rush_pct, 1),
        "estimated_wait_minutes": wait,
        "confidence_score": round(confidence, 2),
        "rush_level": level,
        "forecast_live": False,
        "forecast_starts_at": "13:00 PKT",
    }


async def record_rush_snapshot(db: AsyncSession, restaurant_id: str) -> RushHistory:
    """Persist a rush forecast snapshot for historical learning."""
    rush = await get_current_rush(db, restaurant_id)
    now = now_pkt()
    entry = RushHistory(
        restaurant_id=restaurant_id,
        recorded_at=now.replace(tzinfo=None),
        hour_of_day=now.hour,
        day_of_week=now.weekday(),
        rush_percentage=Decimal(str(rush["rush_percentage"])),
        estimated_wait_minutes=rush["estimated_wait_minutes"],
        confidence_score=Decimal(str(rush["confidence_score"])),
        rush_level=rush["rush_level"],
        source="forecast",
    )
    db.add(entry)
    return entry


async def forecast_day_from_serp(
    db: AsyncSession,
    restaurant_id: str,
    serp_snapshot: SerpTrafficSnapshot,
    opening_hours: dict | None = None,
) -> list[RushHistory]:
    """Generate hourly forecasts from 1pm PKT until restaurant closing."""
    now = now_pkt()
    dow = now.weekday()
    day_key = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][dow]
    popular_times = serp_snapshot.popular_times or {}
    day_data = popular_times.get(day_key, [])

    forecasts = []
    for hour in forecast_hour_range(opening_hours, dow):
        pop = 50.0
        lookup_hour = hour % 24
        if isinstance(day_data, list) and len(day_data) > lookup_hour:
            pop = float(day_data[lookup_hour] or 50)

        hist = await db.scalar(
            select(func.avg(RushHistory.rush_percentage)).where(
                RushHistory.restaurant_id == restaurant_id,
                RushHistory.hour_of_day == lookup_hour,
                RushHistory.day_of_week == dow,
                RushHistory.source != "serp_forecast",
            )
        )
        blended = pop * 0.7 + float(hist or pop) * 0.3
        level = rush_level_from_percentage(blended)

        entry = RushHistory(
            restaurant_id=restaurant_id,
            recorded_at=now.replace(tzinfo=None),
            hour_of_day=lookup_hour,
            day_of_week=dow,
            rush_percentage=Decimal(str(round(blended, 1))),
            estimated_wait_minutes=estimate_wait_minutes(blended),
            confidence_score=Decimal("0.85"),
            rush_level=level,
            source="serp_forecast",
            serp_popularity=int(pop),
        )
        forecasts.append(entry)
        db.add(entry)

    return forecasts
