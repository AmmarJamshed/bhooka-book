"""Proprietary rush score prediction engine.

Combines reservation counts, check-ins, historical data, and daily SERP snapshots
to forecast restaurant busyness without relying on Google Popular Times in real-time.
"""

from datetime import datetime, timedelta
from decimal import Decimal

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CheckIn, Reservation, ReservationStatus, RushHistory, RushLevel, SerpTrafficSnapshot


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
    base_wait = rush_pct * 0.6  # 0-60 min base
    party_factor = 1 + (party_size - 2) * 0.15
    return max(0, int(base_wait * party_factor))


async def get_current_rush(
    db: AsyncSession,
    restaurant_id: str,
    party_size: int = 2,
) -> dict:
    """Calculate current rush score for a restaurant."""
    now = datetime.utcnow()
    hour = now.hour
    dow = now.weekday()

    # Active reservations in next 2 hours
    res_count = await db.scalar(
        select(func.count(Reservation.id)).where(
            Reservation.restaurant_id == restaurant_id,
            Reservation.reservation_date == now.date(),
            Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
        )
    ) or 0

    # Active check-ins (not checked out)
    checkin_count = await db.scalar(
        select(func.count(CheckIn.id)).where(
            CheckIn.restaurant_id == restaurant_id,
            CheckIn.checked_out_at.is_(None),
            CheckIn.checked_in_at >= now - timedelta(hours=3),
        )
    ) or 0

    # Latest SERP snapshot (daily anchor at 1pm)
    serp = await db.scalar(
        select(SerpTrafficSnapshot)
        .where(SerpTrafficSnapshot.restaurant_id == restaurant_id)
        .order_by(SerpTrafficSnapshot.scraped_at.desc())
        .limit(1)
    )

    # Historical average for this hour/day
    hist = await db.scalar(
        select(func.avg(RushHistory.rush_percentage)).where(
            RushHistory.restaurant_id == restaurant_id,
            RushHistory.hour_of_day == hour,
            RushHistory.day_of_week == dow,
        )
    )

    # SERP anchor popularity for current hour (from popular_times JSON)
    serp_hour_pop = 50.0
    if serp and serp.popular_times:
        day_key = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][dow]
        day_data = serp.popular_times.get(day_key, [])
        if isinstance(day_data, list) and len(day_data) > hour:
            serp_hour_pop = float(day_data[hour] or 50)
        elif serp.current_popularity:
            serp_hour_pop = float(serp.current_popularity)

    # Weighted composite score
    reservation_weight = min(res_count * 8, 30)
    checkin_weight = min(checkin_count * 5, 25)
    serp_weight = serp_hour_pop * 0.35
    hist_weight = float(hist or 40) * 0.25

    rush_pct = min(100, reservation_weight + checkin_weight + serp_weight + hist_weight)

    # Confidence increases with more data sources
    confidence = 0.4
    if serp:
        confidence += 0.25
    if hist:
        confidence += 0.2
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
    }


async def record_rush_snapshot(db: AsyncSession, restaurant_id: str) -> RushHistory:
    """Persist a rush forecast snapshot for historical learning."""
    rush = await get_current_rush(db, restaurant_id)
    now = datetime.utcnow()
    entry = RushHistory(
        restaurant_id=restaurant_id,
        recorded_at=now,
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
) -> list[RushHistory]:
    """Generate hourly forecasts for the rest of the day from a 1pm SERP anchor."""
    now = datetime.utcnow()
    dow = now.weekday()
    day_key = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][dow]
    popular_times = serp_snapshot.popular_times or {}
    day_data = popular_times.get(day_key, [])

    forecasts = []
    for hour in range(24):
        pop = 50.0
        if isinstance(day_data, list) and len(day_data) > hour:
            pop = float(day_data[hour] or 50)

        # Blend SERP with historical
        hist = await db.scalar(
            select(func.avg(RushHistory.rush_percentage)).where(
                RushHistory.restaurant_id == restaurant_id,
                RushHistory.hour_of_day == hour,
                RushHistory.day_of_week == dow,
            )
        )
        blended = pop * 0.7 + float(hist or pop) * 0.3
        level = rush_level_from_percentage(blended)

        entry = RushHistory(
            restaurant_id=restaurant_id,
            recorded_at=now,
            hour_of_day=hour,
            day_of_week=dow,
            rush_percentage=Decimal(str(round(blended, 1))),
            estimated_wait_minutes=estimate_wait_minutes(blended),
            confidence_score=Decimal("0.75"),
            rush_level=level,
            source="serp_forecast",
            serp_popularity=int(pop),
        )
        forecasts.append(entry)
        db.add(entry)

    return forecasts
