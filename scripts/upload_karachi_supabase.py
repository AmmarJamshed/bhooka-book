"""Bulk upload Karachi restaurants to Supabase via REST API."""

import json
import os
import sys
import time
from pathlib import Path

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://fpyfshycjtqqrfggvcay.supabase.co")
SUPABASE_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZweWZzaHljanRxcXJmZ2d2Y2F5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjE4ODUsImV4cCI6MjA5Mjc5Nzg4NX0.Xwrd1VYzb_GDf1hw7usRoj23v006p9wZWHJKu_1EwpA",
)
DATA = Path(__file__).parent.parent / "data" / "karachi_restaurants.json"
BATCH = 50

CATEGORY_IDS = {
    "chinese": "lookup",
    "bbq": "lookup",
    "desi": "lookup",
    "seafood": "lookup",
    "cafe": "lookup",
    "fine-dining": "lookup",
    "buffet": "lookup",
    "family": "lookup",
}


def price_estimate(level: str | None) -> int | None:
    if not level:
        return None
    return {"$": 800, "$$": 2000, "$$$": 4500, "$$$$": 8000}.get(level.strip(), 2000)


def fetch_ids(client: httpx.Client) -> tuple[str, dict[str, str]]:
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    city = client.get(
        f"{SUPABASE_URL}/rest/v1/cities?slug=eq.karachi&select=id",
        headers=headers,
    ).json()[0]["id"]
    cats = client.get(f"{SUPABASE_URL}/rest/v1/categories?select=id,slug", headers=headers).json()
    cat_map = {c["slug"]: c["id"] for c in cats}
    return city, cat_map


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    with httpx.Client(timeout=60) as client:
        city_id, cat_map = fetch_ids(client)
        uploaded = 0
        for i in range(0, len(data), BATCH):
            batch = data[i : i + BATCH]
            rows = []
            for r in batch:
                cat_slug = r.get("category_slug", "desi")
                rows.append(
                    {
                        "name": r["name"],
                        "slug": r["slug"],
                        "description": (r.get("description") or "Restaurant in Karachi")[:500],
                        "cuisine": r.get("cuisine", "Desi"),
                        "category_id": cat_map.get(cat_slug, cat_map.get("desi")),
                        "city_id": city_id,
                        "address": r.get("address"),
                        "latitude": r.get("latitude"),
                        "longitude": r.get("longitude"),
                        "phone": r.get("phone"),
                        "average_price": price_estimate(r.get("price_level")),
                        "rating_avg": r.get("rating_avg") or 0,
                        "review_count": r.get("review_count") or 0,
                        "cover_image_url": r.get("cover_image_url"),
                        "google_place_id": r.get("google_place_id"),
                        "is_halal": True,
                        "is_active": True,
                        "is_approved": True,
                        "accepts_ai_bookings": True,
                    }
                )
            resp = client.post(
                f"{SUPABASE_URL}/rest/v1/restaurants?on_conflict=slug",
                headers=headers,
                json=rows,
            )
            if resp.status_code >= 400:
                print(f"Batch {i//BATCH} failed: {resp.status_code} {resp.text[:300]}")
                sys.exit(1)
            uploaded += len(batch)
            print(f"Uploaded {uploaded}/{len(data)}")
            time.sleep(0.2)

    print(f"Done — {uploaded} Karachi restaurants in Supabase.")


if __name__ == "__main__":
    main()
