"""API route handlers."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id, require_auth
from app.models import (
    AIConversation,
    Category,
    CheckIn,
    Favorite,
    MenuItem,
    Reservation,
    ReservationStatus,
    Review,
    Restaurant,
    VoiceCall,
)
from app.schemas import (
    AIReservationCreate,
    CategoryOut,
    ChatMessageCreate,
    ChatMessageOut,
    CheckInCreate,
    CheckOutRequest,
    ReservationCreate,
    ReservationOut,
    RestaurantCard,
    RestaurantDetail,
    RestaurantSearchParams,
    ReviewCreate,
    ReviewOut,
)
from app.services.ai_service import ai_service
from app.services.restaurant_service import get_restaurant_detail, get_special_offers, get_trending, search_restaurants
from app.services.rush_prediction import get_current_rush
from app.services.voice_service import generate_confirmation_code, voice_service

router = APIRouter()


# --- Restaurants ---

@router.get("/restaurants/search", response_model=list[RestaurantCard])
async def api_search_restaurants(
    query: str | None = None,
    cuisine: str | None = None,
    category: str | None = None,
    max_price: int | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    params = RestaurantSearchParams(
        query=query,
        cuisine=cuisine,
        category=category,
        max_price=max_price,
        latitude=latitude,
        longitude=longitude,
        limit=limit,
    )
    return await search_restaurants(db, params)


@router.get("/restaurants/trending", response_model=list[RestaurantCard])
async def api_trending(limit: int = 8, db: AsyncSession = Depends(get_db)):
    return await get_trending(db, limit)


@router.get("/restaurants/{slug}", response_model=RestaurantDetail)
async def api_restaurant_detail(slug: str, db: AsyncSession = Depends(get_db)):
    restaurant = await get_restaurant_detail(db, slug)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return restaurant


@router.get("/restaurants/{slug}/menu")
async def api_restaurant_menu(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Restaurant).where(Restaurant.slug == slug)
    )
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    menu = await db.execute(
        select(MenuItem).where(MenuItem.restaurant_id == restaurant.id, MenuItem.is_available == True)  # noqa: E712
    )
    return [{"id": str(m.id), "name": m.name, "description": m.description, "price": m.price, "category": m.category, "image_url": m.image_url} for m in menu.scalars()]


@router.get("/restaurants/{slug}/rush")
async def api_restaurant_rush(slug: str, party_size: int = 2, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Restaurant).where(Restaurant.slug == slug))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return await get_current_rush(db, str(restaurant.id), party_size)


@router.get("/categories", response_model=list[CategoryOut])
async def api_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).where(Category.is_active == True).order_by(Category.sort_order))  # noqa: E712
    return result.scalars().all()


@router.get("/offers")
async def api_offers(db: AsyncSession = Depends(get_db)):
    return await get_special_offers(db)


# --- Reservations ---

@router.post("/reservations", response_model=ReservationOut)
async def create_reservation(
    data: ReservationCreate,
    user_id: str | None = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    reservation = Reservation(
        user_id=UUID(user_id) if user_id else None,
        restaurant_id=data.restaurant_id,
        guest_name=data.guest_name,
        guest_phone=data.guest_phone,
        party_size=data.party_size,
        reservation_date=data.reservation_date,
        reservation_time=data.reservation_time,
        special_requests=data.special_requests,
        preferences=data.preferences.model_dump(),
        is_ai_booking=data.is_ai_booking,
        confirmation_code=generate_confirmation_code() if not data.is_ai_booking else None,
        status=ReservationStatus.CONFIRMED if not data.is_ai_booking else ReservationStatus.PENDING,
    )
    db.add(reservation)
    await db.flush()
    return reservation


@router.post("/reservations/ai", response_model=ReservationOut)
async def create_ai_reservation(
    data: AIReservationCreate,
    user_id: str | None = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create reservation and trigger AI voice call to restaurant."""
    restaurant = await db.get(Restaurant, data.restaurant_id)
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    if not restaurant.accepts_ai_bookings:
        raise HTTPException(status_code=400, detail="Restaurant does not accept AI bookings")

    reservation = Reservation(
        user_id=UUID(user_id) if user_id else None,
        restaurant_id=data.restaurant_id,
        guest_name=data.guest_name,
        guest_phone=data.guest_phone,
        party_size=data.party_size,
        reservation_date=data.reservation_date,
        reservation_time=data.reservation_time,
        special_requests=data.special_requests,
        preferences=data.preferences.model_dump(),
        is_ai_booking=True,
        status=ReservationStatus.PENDING,
    )
    db.add(reservation)
    await db.flush()

    voice_call = await voice_service.initiate_reservation_call(db, reservation, restaurant)

    return reservation


@router.get("/reservations/me", response_model=list[ReservationOut])
async def my_reservations(user_id: str = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Reservation).where(Reservation.user_id == UUID(user_id)).order_by(Reservation.reservation_date.desc())
    )
    return result.scalars().all()


# --- Reviews ---

@router.get("/restaurants/{slug}/reviews", response_model=list[ReviewOut])
async def restaurant_reviews(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Restaurant).where(Restaurant.slug == slug))
    restaurant = result.scalar_one_or_none()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    reviews = await db.execute(select(Review).where(Review.restaurant_id == restaurant.id).order_by(Review.created_at.desc()))  # type: ignore[attr-defined]
    return reviews.scalars().all()


@router.post("/reviews", response_model=ReviewOut)
async def create_review(data: ReviewCreate, user_id: str = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    overall = (data.food_rating + data.service_rating + data.ambience_rating + data.value_rating) / 4
    review = Review(
        user_id=UUID(user_id),
        restaurant_id=data.restaurant_id,
        food_rating=data.food_rating,
        service_rating=data.service_rating,
        ambience_rating=data.ambience_rating,
        value_rating=data.value_rating,
        overall_rating=overall,
        review_text=data.review_text,
        photo_urls=data.photo_urls,
    )
    db.add(review)
    return review


# --- Favorites ---

@router.get("/favorites")
async def my_favorites(user_id: str = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Favorite).where(Favorite.user_id == UUID(user_id)))
    return [{"restaurant_id": str(f.restaurant_id)} for f in result.scalars()]


@router.post("/favorites/{restaurant_id}")
async def add_favorite(restaurant_id: UUID, user_id: str = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    fav = Favorite(user_id=UUID(user_id), restaurant_id=restaurant_id)
    db.add(fav)
    return {"status": "added"}


@router.delete("/favorites/{restaurant_id}")
async def remove_favorite(restaurant_id: UUID, user_id: str = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Favorite).where(Favorite.user_id == UUID(user_id), Favorite.restaurant_id == restaurant_id)
    )
    fav = result.scalar_one_or_none()
    if fav:
        await db.delete(fav)
    return {"status": "removed"}


# --- Check-ins ---

@router.post("/check-ins")
async def check_in(data: CheckInCreate, user_id: str | None = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    entry = CheckIn(
        user_id=UUID(user_id) if user_id else None,
        restaurant_id=data.restaurant_id,
        party_size=data.party_size,
    )
    db.add(entry)
    return {"id": str(entry.id), "status": "checked_in"}


@router.post("/check-ins/checkout")
async def check_out(data: CheckOutRequest, user_id: str | None = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    from datetime import datetime

    entry = await db.get(CheckIn, data.check_in_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Check-in not found")
    entry.checked_out_at = datetime.utcnow()
    return {"status": "checked_out"}


# --- AI Chat ---

@router.post("/ai/chat", response_model=ChatMessageOut)
async def ai_chat(data: ChatMessageCreate, user_id: str | None = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    # Parse intent for context
    intent = await ai_service.parse_search_intent(data.message)
    context_parts = []
    if intent.get("cuisine"):
        params = RestaurantSearchParams(cuisine=intent["cuisine"], limit=5)
        results = await search_restaurants(db, params)
        if results:
            context_parts.append("Matching restaurants: " + ", ".join(f"{r.name} ({r.cuisine})" for r in results))

    context = "\n".join(context_parts) if context_parts else None
    response = await ai_service.chat([{"role": "user", "content": data.message}], context=context)

    if user_id:
        db.add(AIConversation(user_id=UUID(user_id), session_id=str(data.session_id), role="user", content=data.message))
        db.add(AIConversation(user_id=UUID(user_id), session_id=str(data.session_id), role="assistant", content=response))

    return ChatMessageOut(role="assistant", content=response, session_id=data.session_id)


# --- Voice webhooks (Twilio) ---

@router.post("/voice/twiml/{call_id}")
async def voice_twiml(call_id: UUID, db: AsyncSession = Depends(get_db)):
    voice_call = await db.get(VoiceCall, call_id)
    if not voice_call:
        return Response(content="<Response><Say>Invalid call.</Say></Response>", media_type="application/xml")

    reservation = await db.get(Reservation, voice_call.reservation_id)
    restaurant = await db.get(Restaurant, voice_call.restaurant_id)
    if not reservation or not restaurant:
        return Response(content="<Response><Say>Error loading reservation.</Say></Response>", media_type="application/xml")

    twiml = voice_service.generate_twiml_greeting(
        restaurant.name,
        reservation.guest_name,
        reservation.party_size,
        str(reservation.reservation_date),
        str(reservation.reservation_time),
    )
    return Response(content=twiml, media_type="application/xml")


@router.post("/voice/status/{call_id}")
async def voice_status(call_id: UUID, request: Request, db: AsyncSession = Depends(get_db)):
    form = await request.form()
    call_status = form.get("CallStatus", "")
    voice_call = await db.get(VoiceCall, call_id)
    if voice_call and call_status == "completed":
        await voice_service.handle_call_completed(db, call_id, transcript="Call completed")
    return {"status": "ok"}


# --- Health ---

@router.get("/health")
async def health():
    return {"status": "healthy", "service": "bhooka-book-api"}
