"""Load karachi_restaurants.json into Supabase via SQL batches."""

import json
import sys
from pathlib import Path

DATA = Path(__file__).parent.parent / "data" / "karachi_restaurants.json"
BATCH_SIZE = 40


def esc(val) -> str:
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, (int, float)):
        return str(val)
    return "'" + str(val).replace("'", "''") + "'"


def price_estimate(level: str | None) -> int | None:
    if not level:
        return None
    return {"$": 800, "$$": 2000, "$$$": 4500, "$$$$": 8000}.get(level.strip(), 2000)


def build_batch(rows: list[dict]) -> str:
    values = []
    for r in rows:
        avg_price = price_estimate(r.get("price_level"))
        values.append(
            f"({esc(r['name'])}, {esc(r['slug'])}, {esc(r.get('description'))}, {esc(r.get('cuisine'))}, "
            f"(SELECT id FROM categories WHERE slug = {esc(r.get('category_slug', 'desi'))} LIMIT 1), "
            f"(SELECT id FROM cities WHERE slug = 'karachi' LIMIT 1), "
            f"{esc(r.get('address'))}, {esc(r.get('latitude'))}, {esc(r.get('longitude'))}, "
            f"{esc(r.get('phone'))}, {esc(avg_price)}, {esc(r.get('rating_avg') or 0)}, "
            f"{esc(r.get('review_count') or 0)}, {esc(r.get('cover_image_url'))}, "
            f"{esc(r.get('google_place_id'))}, true, true, true, true)"
        )

    return (
        "INSERT INTO restaurants (name, slug, description, cuisine, category_id, city_id, address, "
        "latitude, longitude, phone, average_price, rating_avg, review_count, cover_image_url, "
        "google_place_id, is_halal, is_active, is_approved, accepts_ai_bookings) VALUES\n"
        + ",\n".join(values)
        + "\nON CONFLICT (slug) DO UPDATE SET "
        "rating_avg = EXCLUDED.rating_avg, review_count = EXCLUDED.review_count, "
        "address = COALESCE(EXCLUDED.address, restaurants.address), "
        "google_place_id = COALESCE(EXCLUDED.google_place_id, restaurants.google_place_id);"
    )


def main() -> None:
    batch_num = int(sys.argv[1]) if len(sys.argv) > 1 else -1
    data = json.loads(DATA.read_text(encoding="utf-8"))
    batches = [data[i : i + BATCH_SIZE] for i in range(0, len(data), BATCH_SIZE)]

    if batch_num >= 0:
        print(build_batch(batches[batch_num]))
    else:
        print(len(data), "restaurants,", len(batches), "batches")


if __name__ == "__main__":
    main()
