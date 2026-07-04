"""Fetch Karachi restaurants from SerpAPI and save for database import."""

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

import httpx

SERP_API_KEY = sys.argv[1] if len(sys.argv) > 1 else __import__("os").environ.get("SERP_API_KEY", "")
KARACHI_LL = "@24.8607,67.0011,12z"
OUTPUT = Path(__file__).parent.parent / "data" / "karachi_restaurants.json"

SEARCH_QUERIES = [
    "restaurants in Karachi Pakistan",
    "best restaurants Karachi",
    "BBQ restaurants Karachi",
    "desi restaurants Karachi",
    "cafe Karachi",
    "fine dining Karachi",
    "seafood restaurant Karachi",
    "Chinese restaurant Karachi",
    "fast food Karachi",
    "buffet restaurant Karachi",
    "biryani restaurant Karachi",
    "pizza restaurant Karachi",
    "rooftop restaurant Karachi",
    "halal restaurant Karachi",
    "Clifton restaurants Karachi",
    "DHA restaurants Karachi",
    "Saddar restaurants Karachi",
    "North Nazimabad restaurants Karachi",
    "Gulshan restaurants Karachi",
    "Defence restaurants Karachi",
]


def slugify(name: str, place_id: str = "") -> str:
    slug = re.sub(r"[^\w\s-]", "", name.lower())
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    suffix = place_id[-6:] if place_id else str(abs(hash(name)))[-6:]
    return f"{slug[:50]}-{suffix}" if slug else f"restaurant-{suffix}"


def infer_cuisine(title: str, types: list | None, query: str) -> str:
    text = f"{title} {' '.join(types or [])} {query}".lower()
    mapping = [
        ("BBQ", ["bbq", "barbecue", "grill"]),
        ("Chinese", ["chinese", "dim sum", "pan-asian", "szechuan"]),
        ("Desi", ["desi", "pakistani", "biryani", "karahi", "tikka", "mughlai", "indian"]),
        ("Seafood", ["seafood", "fish", "prawn", "crab"]),
        ("Cafe", ["cafe", "coffee", "bakery", "dessert"]),
        ("Fast Food", ["fast food", "burger", "pizza", "fried chicken"]),
        ("Fine Dining", ["fine dining", "steakhouse", "continental"]),
        ("Buffet", ["buffet"]),
    ]
    for cuisine, keywords in mapping:
        if any(k in text for k in keywords):
            return cuisine
    return "Desi"


def infer_category_slug(cuisine: str) -> str:
    return {
        "Chinese": "chinese",
        "BBQ": "bbq",
        "Desi": "desi",
        "Seafood": "seafood",
        "Cafe": "cafe",
        "Fine Dining": "fine-dining",
        "Buffet": "buffet",
        "Fast Food": "desi",
    }.get(cuisine, "desi")


def fetch_query(client: httpx.Client, query: str) -> list[dict]:
    params = {
        "engine": "google_maps",
        "type": "search",
        "q": query,
        "ll": KARACHI_LL,
        "hl": "en",
        "gl": "pk",
        "api_key": SERP_API_KEY,
        "start": 0,
    }
    results: list[dict] = []
    seen_ids: set[str] = set()

    for _ in range(6):  # up to 120 per query
        resp = client.get("https://serpapi.com/search.json", params=params, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        local = data.get("local_results") or []
        if not local:
            break

        for place in local:
            pid = place.get("place_id") or place.get("data_id") or place.get("title", "")
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            title = place.get("title") or place.get("name")
            if not title:
                continue
            cuisine = infer_cuisine(title, place.get("types"), query)
            results.append(
                {
                    "name": title,
                    "slug": slugify(title, str(pid)),
                    "description": (place.get("description") or place.get("snippet") or f"Restaurant in Karachi")[:500],
                    "cuisine": cuisine,
                    "category_slug": infer_category_slug(cuisine),
                    "address": place.get("address"),
                    "phone": place.get("phone"),
                    "latitude": place.get("gps_coordinates", {}).get("latitude"),
                    "longitude": place.get("gps_coordinates", {}).get("longitude"),
                    "rating_avg": place.get("rating"),
                    "review_count": place.get("reviews") or 0,
                    "google_place_id": place.get("place_id"),
                    "cover_image_url": place.get("thumbnail"),
                    "price_level": place.get("price"),
                }
            )

        pagination = data.get("serpapi_pagination") or {}
        next_url = pagination.get("next")
        if not next_url:
            break
        next_params = dict(parse_qsl(urlsplit(next_url).query))
        params.update({k: v for k, v in next_params.items() if k != "api_key"})
        time.sleep(0.5)

    return results


def main() -> None:
    if not SERP_API_KEY:
        print("SERP_API_KEY required")
        sys.exit(1)

    all_places: dict[str, dict] = {}
    with httpx.Client() as client:
        for i, query in enumerate(SEARCH_QUERIES, 1):
            print(f"[{i}/{len(SEARCH_QUERIES)}] {query}...")
            try:
                for place in fetch_query(client, query):
                    key = place.get("google_place_id") or place["slug"]
                    all_places[key] = place
                print(f"  total unique: {len(all_places)}")
            except Exception as e:
                print(f"  error: {e}")
            time.sleep(1)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(list(all_places.values()), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nSaved {len(all_places)} Karachi restaurants to {OUTPUT}")


if __name__ == "__main__":
    main()
