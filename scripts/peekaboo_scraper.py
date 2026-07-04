"""Scrape Peekaboo Guru card discounts for Karachi restaurants.

Runs weekly (Mondays via GitHub Actions). Matches Peekaboo entities to Bhooka
restaurants by normalized name, then upserts associated card deals into special_offers.
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
DATABASE_URL = os.environ["DATABASE_URL"]
MATCH_THRESHOLD = 0.82


def normalize_name(name: str) -> str:
    cleaned = re.sub(r"[^a-z0-9\s]", " ", name.lower())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    for suffix in (" karachi", " restaurant", " resturant", " cafe", " bbq"):
        if cleaned.endswith(suffix):
            cleaned = cleaned[: -len(suffix)].strip()
    return cleaned


def best_entity_match(name: str, entities: list[dict]) -> dict | None:
    target = normalize_name(name)
    best: dict | None = None
    best_score = 0.0
    for entity in entities:
        candidate = normalize_name(entity.get("name", ""))
        if not candidate:
            continue
        if candidate == target:
            return entity
        score = SequenceMatcher(None, target, candidate).ratio()
        if target in candidate or candidate in target:
            score = max(score, 0.9)
        if score > best_score:
            best_score = score
            best = entity
    if best_score >= MATCH_THRESHOLD:
        return best
    return None


async def fetch_all_entities(client: httpx.AsyncClient) -> list[dict]:
    entities: list[dict] = []
    offset = 0
    limit = 100
    while True:
        body = {
            "limit": limit,
            "offset": offset,
            "language": "en",
            "category": "food",
            **KARACHI,
        }
        response = await client.post(
            f"{PEEKABOO_BASE}/api/v5/entities",
            json=body,
            headers={"Authorization": f"Bearer {GUEST_JWT}", "Content-Type": "application/json"},
            timeout=30,
        )
        response.raise_for_status()
        batch = response.json()
        if not batch:
            break
        entities.extend(batch)
        if not batch[-1].get("nextPage", False):
            break
        offset += limit
        if offset > 5000:
            break
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
            headers={"Authorization": f"Bearer {GUEST_JWT}", "Content-Type": "application/json"},
            timeout=30,
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
    engine = create_async_engine(DATABASE_URL)
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
        print(f"Matching {len(restaurants)} Bhooka restaurants")

        matched = 0
        offer_count = 0
        for restaurant in restaurants:
            entity = best_entity_match(restaurant.name, with_deals)
            if not entity:
                continue

            entity_id = entity["entityId"]
            await db.execute(
                text("UPDATE restaurants SET peekaboo_entity_id = :eid WHERE id = :rid"),
                {"eid": entity_id, "rid": str(restaurant.id)},
            )

            deals = await fetch_entity_deals(client, entity_id)
            if not deals:
                continue

            matched += 1
            offer_count += await upsert_deals(db, str(restaurant.id), entity_id, deals)
            print(f"  ✓ {restaurant.name} → {len(deals)} card offers")

        await db.commit()
        print(f"Done: {matched} restaurants matched, {offer_count} offers upserted")


if __name__ == "__main__":
    asyncio.run(run_scraper())
