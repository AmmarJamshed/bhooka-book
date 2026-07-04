"""Scrape all Peekaboo card deals and load into Supabase via SQL batches.

Usage:
  set NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  python scripts/peekaboo_load_offers.py
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from pathlib import Path

import httpx

sys.path.insert(0, os.path.dirname(__file__))
from peekaboo_scraper import (  # noqa: E402
    build_restaurant_index,
    card_names,
    fetch_all_entities,
    fetch_entity_deals,
    match_restaurant,
)


class RestaurantRow:
    def __init__(self, row: dict):
        self.id = row["id"]
        self.name = row["name"]
        self.slug = row["slug"]
        self.rating_avg = row.get("rating_avg") or 0
        self.review_count = row.get("review_count") or 0


def sql_escape(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


async def load_restaurants() -> list[RestaurantRow]:
    url = os.environ.get("SUPABASE_URL", "https://fpyfshycjtqqrfggvcay.supabase.co")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not key:
        raise SystemExit("Set NEXT_PUBLIC_SUPABASE_ANON_KEY")

    rows: list[RestaurantRow] = []
    offset = 0
    async with httpx.AsyncClient() as client:
        while True:
            resp = await client.get(
                f"{url}/rest/v1/restaurants",
                params={
                    "select": "id,name,slug,rating_avg,review_count",
                    "is_approved": "eq.true",
                    "is_active": "eq.true",
                    "limit": 1000,
                    "offset": offset,
                },
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
                timeout=60,
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            rows.extend(RestaurantRow(r) for r in batch)
            if len(batch) < 1000:
                break
            offset += 1000
    return rows


async def scrape_all_offers() -> list[dict]:
    async with httpx.AsyncClient() as client:
        restaurants = await load_restaurants()
        by_name, by_slug = build_restaurant_index(restaurants)  # type: ignore[arg-type]
        print(f"Loaded {len(restaurants)} restaurants, {len(by_name)} unique names")

        entities = await fetch_all_entities(client)
        with_deals = [e for e in entities if (e.get("associatedDealCount") or 0) > 0]
        print(f"Peekaboo: {len(entities)} entities, {len(with_deals)} with card deals")

        offers: list[dict] = []
        matched_entities = 0
        for i, entity in enumerate(with_deals):
            restaurant = match_restaurant(entity, by_name, by_slug)  # type: ignore[arg-type]
            if not restaurant:
                continue
            deals = await fetch_entity_deals(client, entity["entityId"])
            if not deals:
                continue
            matched_entities += 1
            for deal in deals:
                offers.append(
                    {
                        "restaurant_id": str(restaurant.id),
                        "restaurant_name": restaurant.name,
                        "peekaboo_entity_id": entity["entityId"],
                        "peekaboo_deal_id": str(deal.get("dealId")),
                        "title": deal.get("title") or f"{deal.get('percentageValue', '')}% off",
                        "description": deal.get("description"),
                        "discount_percent": deal.get("percentageValue"),
                        "bank_name": deal.get("sourceEntityName"),
                        "card_name": ", ".join(card_names(deal)),
                        "valid_from": deal.get("startDate"),
                        "valid_until": deal.get("endDate"),
                    }
                )
            print(f"  [{i+1}/{len(with_deals)}] {entity.get('name', '?')[:60]} -> {restaurant.name[:60]} ({len(deals)} deals)")
            await asyncio.sleep(0.2)

        print(f"Matched {matched_entities} entities, {len(offers)} total offers")
        return offers


def offers_to_sql(offers: list[dict]) -> str:
    lines = [
        "-- Peekaboo card offers bulk load",
        "UPDATE restaurants SET peekaboo_entity_id = NULL WHERE peekaboo_entity_id IS NOT NULL;",
    ]
    entity_updates = {o["restaurant_id"]: o["peekaboo_entity_id"] for o in offers}
    for rid, eid in entity_updates.items():
        lines.append(f"UPDATE restaurants SET peekaboo_entity_id = {eid} WHERE id = '{rid}';")

    for o in offers:
        lines.append(
            "INSERT INTO special_offers (restaurant_id, title, description, discount_percent, "
            "valid_from, valid_until, is_active, source, card_name, bank_name, peekaboo_deal_id, "
            "peekaboo_entity_id, terms) VALUES ("
            f"{sql_escape(o['restaurant_id'])}, "
            f"{sql_escape(o['title'])}, "
            f"{sql_escape(o.get('description'))}, "
            f"{o['discount_percent'] if o.get('discount_percent') is not None else 'NULL'}, "
            f"{sql_escape(o.get('valid_from'))}, "
            f"{sql_escape(o.get('valid_until'))}, "
            "true, 'peekaboo', "
            f"{sql_escape(o.get('card_name'))}, "
            f"{sql_escape(o.get('bank_name'))}, "
            f"{sql_escape(o['peekaboo_deal_id'])}, "
            f"{o['peekaboo_entity_id']}, "
            f"{sql_escape(o.get('description'))}"
            ") ON CONFLICT (restaurant_id, peekaboo_deal_id) WHERE peekaboo_deal_id IS NOT NULL "
            "DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, "
            "discount_percent = EXCLUDED.discount_percent, valid_from = EXCLUDED.valid_from, "
            "valid_until = EXCLUDED.valid_until, is_active = true, card_name = EXCLUDED.card_name, "
            "bank_name = EXCLUDED.bank_name, terms = EXCLUDED.terms;"
        )
    return "\n".join(lines)


async def main() -> None:
    offers = await scrape_all_offers()
    out_dir = Path(__file__).parent.parent / "data"
    out_dir.mkdir(exist_ok=True)

    json_path = out_dir / "peekaboo_offers_export.json"
    json_path.write_text(json.dumps(offers, indent=2, ensure_ascii=False), encoding="utf-8")

    sql_path = out_dir / "peekaboo_offers_load.sql"
    sql_path.write_text(offers_to_sql(offers), encoding="utf-8")
    print(f"Wrote {json_path} and {sql_path} ({len(offers)} offers)")


if __name__ == "__main__":
    asyncio.run(main())
