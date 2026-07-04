"""Scrape Peekaboo Guru card discounts for Karachi restaurants.

Runs weekly (Mondays via GitHub Actions). Matches Peekaboo entities to Bhooka
restaurants by name and slug, then upserts associated card deals into special_offers.
"""

from __future__ import annotations

import asyncio
import os
import re
import sys
from datetime import datetime, timezone
from difflib import SequenceMatcher

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.models import Restaurant  # noqa: E402

PEEKABOO_BASE = "https://peekaboo.guru"
GUEST_JWT = (
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9."
    "eyJpZCI6NzIsInJvbGUiOiJndWVzdCIsImlhdCI6MTU1MzcwMDgwNiwianRpIjoiUEpJMXFTb2ktQzRBZFJWcm9nb3RNV2UzV3VXcFdXTm0ifQ."
    "2mb26xL4Qt7FfBQZ-XQvp-fhecMpaVUVXWp_GEST_6U"
)
KARACHI = {"country": "Pakistan", "city": "Karachi", "lat": 24.861462, "long": 67.009939}
MATCH_THRESHOLD = 0.86
HEADERS = {"Authorization": f"Bearer {GUEST_JWT}", "Content-Type": "application/json"}
GENERIC_NAMES = frozenset({"restaurant", "karachi", "food", "cafe", "kitchen", "dhaba"})


def is_matchable_name(norm: str) -> bool:
    if not norm or norm in GENERIC_NAMES:
        return False
    if len(norm) < 6:
        return False
    if len(norm.split()) < 2:
        return False
    return True


def normalize_name(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", name.lower())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if cleaned.endswith(" karachi"):
        cleaned = cleaned[: -len(" karachi")].strip()
    return cleaned


def slug_base(slug: str) -> str:
    base = slug.lower().strip()
    base = re.sub(r"-[a-z0-9]{6}$", "", base)
    base = re.sub(r"-karachi$", "", base)
    return base


def name_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    ratio = SequenceMatcher(None, a, b).ratio()
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    if len(shorter) >= 10 and shorter in longer:
        ratio = max(ratio, 0.9)
    return ratio


def restaurant_score(restaurant: Restaurant) -> float:
    rating = float(restaurant.rating_avg or 0)
    reviews = int(restaurant.review_count or 0)
    return rating * 1000 + reviews


def build_restaurant_index(restaurants: list[Restaurant]) -> tuple[dict[str, Restaurant], dict[str, Restaurant]]:
    by_name: dict[str, Restaurant] = {}
    by_slug: dict[str, Restaurant] = {}

    for restaurant in restaurants:
        norm = normalize_name(restaurant.name)
        if not is_matchable_name(norm):
            continue
        existing = by_name.get(norm)
        if not existing or restaurant_score(restaurant) > restaurant_score(existing):
            by_name[norm] = restaurant

        for key in {slug_base(restaurant.slug), normalize_name(restaurant.name).replace(" ", "-")}:
            if not key:
                continue
            existing_slug = by_slug.get(key)
            if not existing_slug or restaurant_score(restaurant) > restaurant_score(existing_slug):
                by_slug[key] = restaurant

    return by_name, by_slug


def match_restaurant(entity: dict, by_name: dict[str, Restaurant], by_slug: dict[str, Restaurant]) -> Restaurant | None:
    entity_name = normalize_name(entity.get("name", ""))
    entity_slug = slug_base(entity.get("slug", ""))

    if entity_slug and entity_slug in by_slug:
        return by_slug[entity_slug]

    if entity_name and entity_name in by_name:
        return by_name[entity_name]

    best: Restaurant | None = None
    best_score = 0.0
    for norm, restaurant in by_name.items():
        score = name_similarity(entity_name, norm)
        if score > best_score:
            best_score = score
            best = restaurant

    if best_score >= MATCH_THRESHOLD:
        return best
    return None


async def fetch_all_entities(client: httpx.AsyncClient) -> list[dict]:
    entities: list[dict] = []
    offset = 0
    limit = 100
    while True:
        body = {"limit": limit, "offset": offset, "language": "en", "category": "food", **KARACHI}
        batch: list[dict] = []
        for attempt in range(4):
            response = await client.post(
                f"{PEEKABOO_BASE}/api/v5/entities",
                json=body,
                headers=HEADERS,
                timeout=60,
            )
            if response.status_code >= 500:
                await asyncio.sleep(2**attempt)
                continue
            response.raise_for_status()
            batch = response.json()
            break
        if not batch:
            break
        entities.extend(batch)
        if not batch[-1].get("nextPage", False):
            break
        offset += limit
        await asyncio.sleep(0.25)
    return entities


async def fetch_entity_deals(client: httpx.AsyncClient, entity_id: int) -> list[dict]:
    deals: list[dict] = []
    offset = 0
    limit = 50
    while True:
        body = {
            "limit": limit,
            "offset": offset,
            "language": "en",
            **KARACHI,
            "targetEntityId": entity_id,
            "associatedDeals": True,
        }
        response = await client.post(
            f"{PEEKABOO_BASE}/api/v8/entity/deals",
            json=body,
            headers=HEADERS,
            timeout=60,
        )
        if response.status_code != 200:
            break
        payload = response.json()
        batch = payload.get("deals", []) if isinstance(payload, dict) else payload
        if not batch:
            break
        deals.extend(batch)
        total = payload.get("total", len(deals)) if isinstance(payload, dict) else len(deals)
        offset += limit
        if offset >= total:
            break
    return deals


def card_names(deal: dict) -> list[str]:
    associations = deal.get("associations") or []
    names = [a.get("name") for a in associations if a.get("name")]
    if names:
        return names
    bank = deal.get("sourceEntityName")
    return [bank] if bank else ["Card Offer"]


async def upsert_deals(db: AsyncSession, restaurant_id: str, entity_id: int, deals: list[dict]) -> int:
    count = 0
    for deal in deals:
        deal_id = str(deal.get("dealId", ""))
        if not deal_id:
            continue
        cards = card_names(deal)
        card_name = ", ".join(cards)
        bank_name = deal.get("sourceEntityName")
        title = deal.get("title") or f"{deal.get('percentageValue', '')}% off"
        description = deal.get("description")
        discount = deal.get("percentageValue")
        valid_from = deal.get("startDate")
        valid_until = deal.get("endDate")

        await db.execute(
            text(
                """
                INSERT INTO special_offers (
                    restaurant_id, title, description, discount_percent,
                    valid_from, valid_until, is_active, source,
                    card_name, bank_name, peekaboo_deal_id, peekaboo_entity_id, terms
                ) VALUES (
                    :restaurant_id, :title, :description, :discount_percent,
                    :valid_from, :valid_until, true, 'peekaboo',
                    :card_name, :bank_name, :deal_id, :entity_id, :terms
                )
                ON CONFLICT (restaurant_id, peekaboo_deal_id)
                WHERE peekaboo_deal_id IS NOT NULL
                DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    discount_percent = EXCLUDED.discount_percent,
                    valid_from = EXCLUDED.valid_from,
                    valid_until = EXCLUDED.valid_until,
                    is_active = true,
                    card_name = EXCLUDED.card_name,
                    bank_name = EXCLUDED.bank_name,
                    terms = EXCLUDED.terms
                """
            ),
            {
                "restaurant_id": restaurant_id,
                "title": title,
                "description": description,
                "discount_percent": discount,
                "valid_from": valid_from,
                "valid_until": valid_until,
                "card_name": card_name,
                "bank_name": bank_name,
                "deal_id": deal_id,
                "entity_id": entity_id,
                "terms": description,
            },
        )
        count += 1
    return count


async def run_scraper() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL environment variable is required")

    engine = create_async_engine(database_url)
    Session = async_sessionmaker(engine, class_=AsyncSession)

    async with httpx.AsyncClient() as client, Session() as db:
        print(f"Fetching Peekaboo entities at {datetime.now(timezone.utc).isoformat()}")
        entities = await fetch_all_entities(client)
        with_deals = [e for e in entities if (e.get("associatedDealCount") or 0) > 0]
        print(f"  {len(entities)} entities, {len(with_deals)} with card deals")

        result = await db.execute(
            select(Restaurant).where(
                Restaurant.is_approved == True,  # noqa: E712
                Restaurant.is_active == True,  # noqa: E712
            )
        )
        restaurants = result.scalars().all()
        by_name, by_slug = build_restaurant_index(restaurants)
        print(f"Indexed {len(by_name)} unique restaurant names from {len(restaurants)} rows")

        matched = 0
        offer_count = 0
        unmatched: list[str] = []

        for entity in with_deals:
            restaurant = match_restaurant(entity, by_name, by_slug)
            if not restaurant:
                unmatched.append(entity.get("name", "?"))
                continue

            entity_id = entity["entityId"]
            deals = await fetch_entity_deals(client, entity_id)
            if not deals:
                continue

            await db.execute(
                text("UPDATE restaurants SET peekaboo_entity_id = :eid WHERE id = :rid"),
                {"eid": entity_id, "rid": str(restaurant.id)},
            )

            matched += 1
            offer_count += await upsert_deals(db, str(restaurant.id), entity_id, deals)
            print(f"  ✓ {entity.get('name')} → {restaurant.name} ({len(deals)} offers)")
            await asyncio.sleep(0.15)

        await db.commit()
        print(f"Done: {matched} restaurants matched, {offer_count} offers upserted")
        if unmatched:
            print(f"Unmatched Peekaboo entities ({len(unmatched)}): {', '.join(unmatched[:20])}")
            if len(unmatched) > 20:
                print(f"  ... and {len(unmatched) - 20} more")


if __name__ == "__main__":
    asyncio.run(run_scraper())
