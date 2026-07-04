/** Supabase direct data access — used when API backend is unavailable */

import { createClient } from "@/lib/supabase";
import type { Category, Restaurant, RestaurantDetail, RushInfo, SpecialOffer } from "@/types";

function defaultRush(): RushInfo {
  return {
    rush_percentage: 45,
    estimated_wait_minutes: 20,
    confidence_score: 0.5,
    rush_level: "moderate",
  };
}

function mapRestaurant(row: Record<string, unknown>): Restaurant {
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
    latitude: row.latitude ? Number(row.latitude) : undefined,
    longitude: row.longitude ? Number(row.longitude) : undefined,
    is_open: true,
    rush: defaultRush(),
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
    return data.map(mapRestaurant);
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

      const { data: rows } = await fallback;
      return (rows || []).map(mapRestaurant);
    }
    return data.map(mapRestaurant);
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
    const base = mapRestaurant(data);
    return {
      ...base,
      description: data.description || undefined,
      phone: data.phone || undefined,
      gallery_urls: data.gallery_urls || [],
      opening_hours: data.opening_hours || {},
      facilities: data.facilities || {},
      is_halal: data.is_halal ?? true,
      accepts_ai_bookings: data.accepts_ai_bookings ?? true,
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
      .limit(6);

    return (data || []).map((o: Record<string, unknown>) => ({
      id: o.id as string,
      title: o.title as string,
      description: o.description as string | undefined,
      discount_percent: o.discount_percent as number | undefined,
      restaurant: {
        name: (o.restaurants as Record<string, string>)?.name,
        slug: (o.restaurants as Record<string, string>)?.slug,
        cover_image_url: (o.restaurants as Record<string, string>)?.cover_image_url,
      },
    }));
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
