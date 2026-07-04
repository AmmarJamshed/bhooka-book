/** Bhooka Book shared TypeScript types */

export type RushLevel = "quiet" | "moderate" | "busy" | "very_busy";

export interface RushInfo {
  rush_percentage: number;
  estimated_wait_minutes: number;
  confidence_score: number;
  rush_level: RushLevel;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  cuisine?: string;
  cover_image_url?: string;
  rating_avg: number;
  review_count: number;
  average_price?: number;
  address?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  is_open: boolean;
  rush?: RushInfo;
}

export interface RestaurantDetail extends Restaurant {
  description?: string;
  phone?: string;
  gallery_urls: string[];
  opening_hours: Record<string, unknown>;
  facilities: Record<string, boolean>;
  is_halal: boolean;
  accepts_ai_bookings: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  image_url?: string;
  is_available: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface Reservation {
  id: string;
  restaurant_id: string;
  guest_name: string;
  guest_phone: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled" | "completed";
  special_requests?: string;
  preferences: Record<string, boolean>;
  is_ai_booking: boolean;
  confirmation_code?: string;
  estimated_wait_minutes?: number;
}

export interface ReservationPreferences {
  birthday: boolean;
  wheelchair: boolean;
  baby_chair: boolean;
  outdoor: boolean;
  window_seat: boolean;
  smoking: boolean;
  non_smoking: boolean;
}

export interface Review {
  id: string;
  restaurant_id: string;
  food_rating?: number;
  service_rating?: number;
  ambience_rating?: number;
  value_rating?: number;
  overall_rating?: number;
  review_text?: string;
  helpful_count: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SpecialOffer {
  id: string;
  title: string;
  description?: string;
  discount_percent?: number;
  restaurant: { name: string; slug: string; cover_image_url?: string };
}

export const RUSH_LABELS: Record<RushLevel, string> = {
  quiet: "Quiet",
  moderate: "Moderate",
  busy: "Busy",
  very_busy: "Very Busy",
};

export const RUSH_COLORS: Record<RushLevel, string> = {
  quiet: "bg-success/10 text-success border-success/20",
  moderate: "bg-warning/10 text-warning border-warning/20",
  busy: "bg-primary/10 text-primary border-primary/20",
  very_busy: "bg-destructive/10 text-destructive border-destructive/20",
};

export const QUICK_FILTERS = [
  { label: "Chinese", slug: "chinese", icon: "🥡" },
  { label: "BBQ", slug: "bbq", icon: "🍖" },
  { label: "Desi", slug: "desi", icon: "🍛" },
  { label: "Seafood", slug: "seafood", icon: "🦐" },
  { label: "Cafe", slug: "cafe", icon: "☕" },
  { label: "Fine Dining", slug: "fine-dining", icon: "🍷" },
  { label: "Family", slug: "family", icon: "👨‍👩‍👧‍👦" },
  { label: "Buffet", slug: "buffet", icon: "🍽️" },
];
