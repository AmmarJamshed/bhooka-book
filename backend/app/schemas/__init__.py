"""Pydantic schemas for API request/response validation."""

from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RushLevel(str, Enum):
    QUIET = "quiet"
    MODERATE = "moderate"
    BUSY = "busy"
    VERY_BUSY = "very_busy"


class ReservationStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


# --- Restaurant ---

class RushInfo(BaseModel):
    rush_percentage: float
    estimated_wait_minutes: int
    confidence_score: float
    rush_level: RushLevel


class RestaurantCard(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    cuisine: str | None = None
    cover_image_url: str | None = None
    rating_avg: float = 0
    review_count: int = 0
    average_price: int | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    distance_km: float | None = None
    is_open: bool = True
    rush: RushInfo | None = None


class RestaurantDetail(RestaurantCard):
    description: str | None = None
    phone: str | None = None
    gallery_urls: list[str] = []
    opening_hours: dict = {}
    facilities: dict = {}
    is_halal: bool = True
    accepts_ai_bookings: bool = True


class MenuItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    price: int
    category: str | None = None
    image_url: str | None = None
    is_available: bool = True


class RestaurantSearchParams(BaseModel):
    query: str | None = None
    cuisine: str | None = None
    city: str | None = None
    category: str | None = None
    max_price: int | None = None
    min_rating: float | None = None
    max_rush: RushLevel | None = None
    latitude: float | None = None
    longitude: float | None = None
    radius_km: float = 10
    limit: int = Field(default=20, le=50)
    offset: int = 0


# --- Reservation ---

class ReservationPreferences(BaseModel):
    birthday: bool = False
    wheelchair: bool = False
    baby_chair: bool = False
    outdoor: bool = False
    window_seat: bool = False
    smoking: bool = False
    non_smoking: bool = True


class ReservationCreate(BaseModel):
    restaurant_id: UUID
    guest_name: str = Field(min_length=2, max_length=100)
    guest_phone: str = Field(min_length=10, max_length=20)
    party_size: int = Field(ge=1, le=50)
    reservation_date: date
    reservation_time: time
    special_requests: str | None = None
    preferences: ReservationPreferences = Field(default_factory=ReservationPreferences)
    is_ai_booking: bool = False


class AIReservationCreate(ReservationCreate):
    is_ai_booking: bool = True


class ReservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    guest_name: str
    guest_phone: str
    party_size: int
    reservation_date: date
    reservation_time: time
    status: ReservationStatus
    special_requests: str | None = None
    preferences: dict = {}
    is_ai_booking: bool = False
    confirmation_code: str | None = None
    estimated_wait_minutes: int | None = None


# --- Review ---

class ReviewCreate(BaseModel):
    restaurant_id: UUID
    food_rating: int = Field(ge=1, le=5)
    service_rating: int = Field(ge=1, le=5)
    ambience_rating: int = Field(ge=1, le=5)
    value_rating: int = Field(ge=1, le=5)
    review_text: str | None = None
    photo_urls: list[str] = []


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    food_rating: int | None
    service_rating: int | None
    ambience_rating: int | None
    value_rating: int | None
    overall_rating: float | None
    review_text: str | None
    helpful_count: int = 0
    created_at: datetime | None = None


# --- AI Chat ---

class ChatMessageCreate(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: UUID | None = None


class ChatMessageOut(BaseModel):
    role: str
    content: str
    session_id: UUID | None = None


# --- Check-in ---

class CheckInCreate(BaseModel):
    restaurant_id: UUID
    party_size: int = Field(default=1, ge=1, le=20)


class CheckOutRequest(BaseModel):
    check_in_id: UUID


# --- Category ---

class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    slug: str
    icon: str | None = None
