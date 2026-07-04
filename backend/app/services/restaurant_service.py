"""Restaurant search and retrieval service."""

import math
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Category, Restaurant, SpecialOffer
from app.schemas import RestaurantCard, RestaurantDetail, RestaurantSearchParams, RushInfo
from app.services.rush_prediction import get_current_rush


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in kilometers."""
    r = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def is_restaurant_open(opening_hours: dict) -> bool:
    """Simple open-now check from opening_hours JSON."""
    if not opening_hours:
        return True
    from datetime import datetime

    now = datetime.now()
    day = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][now.weekday()]
    hours = opening_hours.get(day)
    if not hours:
        return True
    return hours.get("open", True)


async def search_restaurants(db: AsyncSession, params: RestaurantSearchParams) -> list[RestaurantCard]:
    """Search restaurants with filters and natural language support."""
    query = (
        select(Restaurant)
        .where(Restaurant.is_approved == True, Restaurant.is_active == True)  # noqa: E712
        .options(selectinload(Restaurant.category))
    )

    if params.query:
        q = f"%{params.query}%"
        query = query.where(
            or_(
                Restaurant.name.ilike(q),
                Restaurant.cuisine.ilike(q),
                Restaurant.description.ilike(q),
                Restaurant.address.ilike(q),
            )
        )

    if params.cuisine:
        query = query.where(Restaurant.cuisine.ilike(f"%{params.cuisine}%"))

    if params.max_price:
        query = query.where(Restaurant.average_price <= params.max_price)

    if params.min_rating:
        query = query.where(Restaurant.rating_avg >= params.min_rating)

    if params.category:
        query = query.join(Category).where(Category.slug == params.category)

    query = query.limit(params.limit).offset(params.offset)
    result = await db.execute(query)
    restaurants = result.scalars().all()

    cards: list[RestaurantCard] = []
    for r in restaurants:
        distance = None
        if params.latitude and params.longitude and r.latitude and r.longitude:
            distance = round(haversine_km(params.latitude, params.longitude, r.latitude, r.longitude), 1)

        rush_data = await get_current_rush(db, str(r.id))
        rush = RushInfo(**rush_data)

        if params.max_rush and rush.rush_level.value > params.max_rush.value:
            continue

        cards.append(
            RestaurantCard(
                id=r.id,
                name=r.name,
                slug=r.slug,
                cuisine=r.cuisine,
                cover_image_url=r.cover_image_url,
                rating_avg=float(r.rating_avg),
                review_count=r.review_count,
                average_price=r.average_price,
                address=r.address,
                latitude=r.latitude,
                longitude=r.longitude,
                distance_km=distance,
                is_open=is_restaurant_open(r.opening_hours),
                rush=rush,
            )
        )

    if params.latitude and params.longitude:
        cards.sort(key=lambda c: c.distance_km or 999)

    return cards


async def get_restaurant_detail(db: AsyncSession, slug: str) -> RestaurantDetail | None:
    """Get full restaurant details by slug."""
    result = await db.execute(
        select(Restaurant)
        .where(Restaurant.slug == slug, Restaurant.is_approved == True)  # noqa: E712
        .options(selectinload(Restaurant.menu_items), selectinload(Restaurant.category))
    )
    r = result.scalar_one_or_none()
    if not r:
        return None

    rush_data = await get_current_rush(db, str(r.id))

    return RestaurantDetail(
        id=r.id,
        name=r.name,
        slug=r.slug,
        description=r.description,
        cuisine=r.cuisine,
        cover_image_url=r.cover_image_url,
        rating_avg=float(r.rating_avg),
        review_count=r.review_count,
        average_price=r.average_price,
        address=r.address,
        phone=r.phone,
        latitude=r.latitude,
        longitude=r.longitude,
        gallery_urls=r.gallery_urls or [],
        opening_hours=r.opening_hours or {},
        facilities=r.facilities or {},
        is_halal=r.is_halal,
        accepts_ai_bookings=r.accepts_ai_bookings,
        is_open=is_restaurant_open(r.opening_hours),
        rush=RushInfo(**rush_data),
    )


async def get_trending(db: AsyncSession, limit: int = 8) -> list[RestaurantCard]:
    """Get trending restaurants by rating and review count."""
    params = RestaurantSearchParams(limit=limit)
    query = (
        select(Restaurant)
        .where(Restaurant.is_approved == True, Restaurant.is_active == True)  # noqa: E712
        .order_by(Restaurant.rating_avg.desc(), Restaurant.review_count.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    restaurants = result.scalars().all()

    cards = []
    for r in restaurants:
        rush_data = await get_current_rush(db, str(r.id))
        cards.append(
            RestaurantCard(
                id=r.id,
                name=r.name,
                slug=r.slug,
                cuisine=r.cuisine,
                cover_image_url=r.cover_image_url,
                rating_avg=float(r.rating_avg),
                review_count=r.review_count,
                average_price=r.average_price,
                address=r.address,
                rush=RushInfo(**rush_data),
            )
        )
    return cards


async def get_special_offers(db: AsyncSession, limit: int = 6) -> list[dict]:
    """Get active special offers with restaurant info."""
    result = await db.execute(
        select(SpecialOffer, Restaurant)
        .join(Restaurant)
        .where(SpecialOffer.is_active == True, Restaurant.is_approved == True)  # noqa: E712
        .limit(limit)
    )
    offers = []
    for offer, restaurant in result.all():
        offers.append(
            {
                "id": str(offer.id),
                "title": offer.title,
                "description": offer.description,
                "discount_percent": offer.discount_percent,
                "restaurant": {"name": restaurant.name, "slug": restaurant.slug, "cover_image_url": restaurant.cover_image_url},
            }
        )
    return offers
