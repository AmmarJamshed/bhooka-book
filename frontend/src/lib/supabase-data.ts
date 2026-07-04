/** Supabase direct data access — used when API backend is unavailable */

import { createClient } from "@/lib/supabase";
import type { Category, Restaurant, RestaurantDetail, RushInfo, SpecialOffer } from "@/types";

const FORECAST_START_HOUR = 13;

function pktNow(): { hour: number; dow: number; beforeForecast: boolean } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());

  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "Mon";
  const dowMap: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const dow = dowMap[weekday.slice(0, 3)] ?? 0;
  return { hour, dow, beforeForecast: hour < FORECAST_START_HOUR };
}

function defaultRush(beforeForecast: boolean): RushInfo {
  return {
    rush_percentage: beforeForecast ? 35 : 45,
    estimated_wait_minutes: beforeForecast ? 15 : 20,
    confidence_score: beforeForecast ? 0.35 : 0.5,
    rush_level: beforeForecast ? "quiet" : "moderate",
    forecast_live: false,
    forecast_starts_at: "13:00 PKT",
  };
}

function mapRushRow(row: Record<string, unknown>): RushInfo {
  return {
    rush_percentage: Number(row.rush_percentage) || 0,
    estimated_wait_minutes: Number(row.estimated_wait_minutes) || 0,
    confidence_score: Number(row.confidence_score) || 0.75,
    rush_level: (row.rush_level as RushInfo["rush_level"]) || "moderate",
    forecast_live: true,
    forecast_starts_at: "13:00 PKT",
  };
}

async function fetchRushMap(restaurantIds: string[]): Promise<Map<string, RushInfo>> {
  const map = new Map<string, RushInfo>();
  if (restaurantIds.length === 0) return map;

  const { hour, dow, beforeForecast } = pktNow();
  if (beforeForecast) return map;

  const supabase = createClient();
  const since = new Date();
  since.setHours(since.getHours() - 18);

  const { data } = await supabase
    .from("rush_history")
    .select("restaurant_id, rush_percentage, estimated_wait_minutes, confidence_score, rush_level, recorded_at")
    .in("restaurant_id", restaurantIds)
    .eq("source", "serp_forecast")
    .eq("hour_of_day", hour)
    .eq("day_of_week", dow)
    .gte("recorded_at", since.toISOString())
    .order("recorded_at", { ascending: false });

  for (const row of data || []) {
    const id = row.restaurant_id as string;
    if (!map.has(id)) {
      map.set(id, mapRushRow(row as Record<string, unknown>));
    }
  }
  return map;
}

function mapRestaurant(row: Record<string, unknown>, rush?: RushInfo): Restaurant {
  const { beforeForecast } = pktNow();
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    cuisine: (row.cuisine as string) || undefined,
    cover_image_url: (row.cover_image_url as string) || undefined,
    rating_avg: Number(row.rating_avg) || 0,
    review_count: Number(row.review_count) || 0,
    average_price: row.average_price ? Number(row.average_price) : undefined,
    address: (row.address as string) || undefined,
    phone: (row.phone as string) || undefined,
    latitude: row.latitude ? Number(row.latitude) : undefined,
    longitude: row.longitude ? Number(row.longitude) : undefined,
    is_open: true,
    rush: rush || defaultRush(beforeForecast),
  };
}

function mapOffer(o: Record<string, unknown>): SpecialOffer {
  const restaurant = o.restaurants as Record<string, string> | null;
  return {
    id: o.id as string,
    title: o.title as string,
    description: o.description as string | undefined,
    discount_percent: o.discount_percent as number | undefined,
    card_name: o.card_name as string | undefined,
    bank_name: o.bank_name as string | undefined,
    source: o.source as string | undefined,
    terms: o.terms as string | undefined,
    valid_until: o.valid_until as string | undefined,
    restaurant: {
      name: restaurant?.name || "",
      slug: restaurant?.slug || "",
      cover_image_url: restaurant?.cover_image_url,
    },
  };
}

export const supabaseData = {
  async getTrending(limit = 8): Promise<Restaurant[]> {
    const supabase = createClient();
    const { data: city } = await supabase.from("cities").select("id").eq("slug", "karachi").single();
    let query = supabase
      .from("restaurants")
      .select("*")
      .eq("is_approved", true)
      .eq("is_active", true)
      .order("rating_avg", { ascending: false })
      .order("review_count", { ascending: false })
      .limit(limit);

    if (city) {
      query = query.eq("city_id", city.id);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const rushMap = await fetchRushMap(data.map((r) => r.id as string));
    return data.map((row) => mapRestaurant(row as Record<string, unknown>, rushMap.get(row.id as string)));
  },

  async search(params: {
    query?: string;
    category?: string;
    city?: string;
    limit?: number;
    offset?: number;
  }): Promise<Restaurant[]> {
    const supabase = createClient();
    const limit = params.limit || 24;
    const offset = params.offset || 0;
    const citySlug = params.city || "karachi";

    const { data: city } = await supabase.from("cities").select("id").eq("slug", citySlug).single();
    if (!city) return [];

    let query = supabase
      .from("restaurants")
      .select("*, categories!inner(slug)")
      .eq("is_approved", true)
      .eq("is_active", true)
      .eq("city_id", city.id)
      .order("rating_avg", { ascending: false })
      .order("review_count", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.query) {
      query = query.or(
        `name.ilike.%${params.query}%,cuisine.ilike.%${params.query}%,address.ilike.%${params.query}%`
      );
    }

    if (params.category) {
      query = query.eq("categories.slug", params.category);
    }

    const { data, error } = await query;
    let rows = data;
    if (error || !data) {
      let fallback = supabase
        .from("restaurants")
        .select("*")
        .eq("is_approved", true)
        .eq("is_active", true)
        .eq("city_id", city.id)
        .order("rating_avg", { ascending: false })
        .order("review_count", { ascending: false })
        .range(offset, offset + limit - 1);

      if (params.query) {
        fallback = fallback.or(
          `name.ilike.%${params.query}%,cuisine.ilike.%${params.query}%,address.ilike.%${params.query}%`
        );
      }

      const { data: fallbackRows } = await fallback;
      rows = fallbackRows;
    }

    const list = rows || [];
    const rushMap = await fetchRushMap(list.map((r) => r.id as string));
    return list.map((row) => mapRestaurant(row as Record<string, unknown>, rushMap.get(row.id as string)));
  },

  async countRestaurants(params: { query?: string; category?: string; city?: string }): Promise<number> {
    const supabase = createClient();
    const citySlug = params.city || "karachi";
    const { data: city } = await supabase.from("cities").select("id").eq("slug", citySlug).single();
    if (!city) return 0;

    let query = supabase
      .from("restaurants")
      .select("id, categories!inner(slug)", { count: "exact", head: true })
      .eq("is_approved", true)
      .eq("is_active", true)
      .eq("city_id", city.id);

    if (params.query) {
      query = query.or(
        `name.ilike.%${params.query}%,cuisine.ilike.%${params.query}%,address.ilike.%${params.query}%`
      );
    }

    if (params.category) {
      query = query.eq("categories.slug", params.category);
    }

    const { count, error } = await query;
    if (error) {
      const { count: fallbackCount } = await supabase
        .from("restaurants")
        .select("id", { count: "exact", head: true })
        .eq("is_approved", true)
        .eq("is_active", true)
        .eq("city_id", city.id);
      return fallbackCount || 0;
    }
    return count || 0;
  },

  async getRestaurant(slug: string): Promise<RestaurantDetail | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .eq("slug", slug)
      .eq("is_approved", true)
      .single();

    if (error || !data) return null;

    const rushMap = await fetchRushMap([data.id as string]);
    const base = mapRestaurant(data as Record<string, unknown>, rushMap.get(data.id as string));
    return {
      ...base,
      description: data.description || undefined,
      phone: data.phone || undefined,
      gallery_urls: data.gallery_urls || [],
      opening_hours: data.opening_hours || {},
      facilities: data.facilities || {},
      is_halal: data.is_halal ?? true,
      accepts_ai_bookings: false,
    };
  },

  async getCategories(): Promise<Category[]> {
    const supabase = createClient();
    const { data } = await supabase.from("categories").select("*").eq("is_active", true).order("sort_order");
    return (data || []) as Category[];
  },

  async getOffers(): Promise<SpecialOffer[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from("special_offers")
      .select("*, restaurants(name, slug, cover_image_url)")
      .eq("is_active", true)
      .order("discount_percent", { ascending: false })
      .limit(12);

    return (data || []).map((o) => mapOffer(o as Record<string, unknown>));
  },

  async getOffersForRestaurant(slug: string): Promise<SpecialOffer[]> {
    const supabase = createClient();
    const { data: restaurant } = await supabase.from("restaurants").select("id").eq("slug", slug).single();
    if (!restaurant) return [];

    const { data } = await supabase
      .from("special_offers")
      .select("*, restaurants(name, slug, cover_image_url)")
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true)
      .order("discount_percent", { ascending: false });

    return (data || []).map((o) => mapOffer(o as Record<string, unknown>));
  },

  async getMenu(slug: string) {
    const supabase = createClient();
    const { data: restaurant } = await supabase.from("restaurants").select("id").eq("slug", slug).single();
    if (!restaurant) return [];

    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("is_available", true);

    return data || [];
  },
};
