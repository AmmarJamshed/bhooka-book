"""Daily SERP API scraper for restaurant traffic data.

Runs once daily at 1pm PKT via GitHub Actions.
Scrapes Google Maps popular times, stores snapshot in Supabase,
then generates hourly rush forecasts for the rest of the day.
"""

import asyncio
import os
import sys
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.models import Restaurant, SerpTrafficSnapshot  # noqa: E402
from app.services.rush_prediction import forecast_day_from_serp  # noqa: E402


SERP_API_KEY = os.environ["SERP_API_KEY"]
DATABASE_URL = os.environ["DATABASE_URL"]


async def scrape_restaurant(client: httpx.AsyncClient, restaurant: Restaurant) -> dict | None:
    """Fetch Google Maps data via SERP API."""
    if not restaurant.google_place_id and not restaurant.name:
        return None

    params = {
        "engine": "google_maps",
        "api_key": SERP_API_KEY,
        "type": "place",
    }
    if restaurant.google_place_id:
        params["place_id"] = restaurant.google_place_id
    else:
        params["q"] = f"{restaurant.name} {restaurant.address or 'Pakistan'}"

    response = await client.get("https://serpapi.com/search.json", params=params, timeout=30)
    response.raise_for_status()
    return response.json()


def extract_popular_times(data: dict) -> tuple[dict | None, int | None, float | None, int | None]:
    """Extract popular times and rating from SERP response."""
    place = data.get("place_results") or data.get("local_results", [{}])[0] if data.get("local_results") else {}
    popular_times = place.get("popular_times")
    current_pop = place.get("popular_times_live", {}).get("popular_times_live_percent")
    rating = place.get("rating")
    review_count = place.get("reviews")
    return popular_times, current_pop, rating, review_count


async def run_scraper() -> None:
    """Main scraper entry point."""
    engine = create_async_engine(DATABASE_URL)
    Session = async_sessionmaker(engine, class_=AsyncSession)

    async with Session() as db, httpx.AsyncClient() as client:
        result = await db.execute(
            select(Restaurant).where(
                Restaurant.is_approved == True,  # noqa: E712
                Restaurant.is_active == True,  # noqa: E712
            )
        )
        restaurants = result.scalars().all()
        print(f"Scraping {len(restaurants)} restaurants at {datetime.utcnow().isoformat()}")

        for restaurant in restaurants:
            try:
                data = await scrape_restaurant(client, restaurant)
                if not data:
                    continue

                popular_times, current_pop, rating, review_count = extract_popular_times(data)

                snapshot = SerpTrafficSnapshot(
                    restaurant_id=restaurant.id,
                    scraped_at=datetime.utcnow(),
                    google_place_id=restaurant.google_place_id,
                    popular_times=popular_times,
                    current_popularity=current_pop,
                    rating=rating,
                    review_count=review_count,
                    raw_data=data,
                )
                db.add(snapshot)
                await db.flush()

                # Generate hourly forecasts from this anchor
                await forecast_day_from_serp(db, str(restaurant.id), snapshot)

                # Update restaurant rating if available
                if rating:
                    restaurant.rating_avg = rating
                if review_count:
                    restaurant.review_count = review_count

                print(f"  ✓ {restaurant.name}")
            except Exception as e:
                print(f"  ✗ {restaurant.name}: {e}")

        await db.commit()

    print("Scrape complete.")


if __name__ == "__main__":
    asyncio.run(run_scraper())
