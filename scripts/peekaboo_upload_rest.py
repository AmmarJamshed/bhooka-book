"""Upload Peekaboo offers to Supabase via REST API (service role required)."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://fpyfshycjtqqrfggvcay.supabase.co")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
BATCH = 50


def main() -> None:
    if not SERVICE_KEY:
        raise SystemExit("Set SUPABASE_SERVICE_ROLE_KEY")

    offers_path = Path(__file__).parent.parent / "data" / "peekaboo_offers_export.json"
    offers = json.loads(offers_path.read_text(encoding="utf-8"))

    rows = [
        {
            "restaurant_id": o["restaurant_id"],
            "title": o["title"],
            "description": o.get("description"),
            "discount_percent": o.get("discount_percent"),
            "valid_from": o.get("valid_from"),
            "valid_until": o.get("valid_until"),
            "is_active": True,
            "source": "peekaboo",
            "card_name": o.get("card_name"),
            "bank_name": o.get("bank_name"),
            "peekaboo_deal_id": o["peekaboo_deal_id"],
            "peekaboo_entity_id": o["peekaboo_entity_id"],
            "terms": o.get("description"),
        }
        for o in offers
    ]

    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    entity_updates = {}
    for o in offers:
        entity_updates[o["restaurant_id"]] = o["peekaboo_entity_id"]

    with httpx.Client(timeout=120) as client:
        for rid, eid in entity_updates.items():
            client.patch(
                f"{SUPABASE_URL}/rest/v1/restaurants?id=eq.{rid}",
                headers=headers,
                json={"peekaboo_entity_id": eid},
            )

        uploaded = 0
        for i in range(0, len(rows), BATCH):
            chunk = rows[i : i + BATCH]
            resp = client.post(
                f"{SUPABASE_URL}/rest/v1/special_offers?on_conflict=restaurant_id,peekaboo_deal_id",
                headers=headers,
                json=chunk,
            )
            if resp.status_code >= 400:
                print(f"Batch {i // BATCH + 1} failed:", resp.status_code, resp.text[:500])
                sys.exit(1)
            uploaded += len(chunk)
            print(f"Uploaded {uploaded}/{len(rows)}")

    print("Done")


if __name__ == "__main__":
    main()
