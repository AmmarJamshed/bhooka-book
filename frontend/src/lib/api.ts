/** API client with Supabase fallback for production */

import { supabaseData } from "@/lib/supabase-data";
import type { Category, Reservation, Restaurant, RestaurantDetail, Review, SpecialOffer } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }
  return res.json();
}

async function withFallback<T>(apiCall: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await apiCall();
  } catch {
    return fallback();
  }
}

export const api = {
  searchRestaurants: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) qs.set(k, String(v));
    });
    return withFallback(
      () => fetchAPI<Restaurant[]>(`/restaurants/search?${qs}`),
      () =>
        supabaseData.search({
          query: params.query as string,
          category: params.category as string,
          city: (params.city as string) || "karachi",
          limit: params.limit as number,
          offset: params.offset as number,
        })
    );
  },

  countRestaurants: (params: Record<string, string | undefined>) =>
    withFallback(
      () => fetchAPI<{ count: number }>(`/restaurants/count?${new URLSearchParams(params as Record<string, string>)}`).then((r) => r.count),
      () =>
        supabaseData.countRestaurants({
          query: params.query,
          category: params.category,
          city: params.city || "karachi",
        })
    ),

  getTrending: () =>
    withFallback(
      () => fetchAPI<Restaurant[]>("/restaurants/trending"),
      () => supabaseData.getTrending()
    ),

  getRestaurant: (slug: string) =>
    withFallback(
      () => fetchAPI<RestaurantDetail>(`/restaurants/${slug}`),
      () => supabaseData.getRestaurant(slug).then((r) => r as RestaurantDetail)
    ),

  getMenu: (slug: string) =>
    withFallback(
      () => fetchAPI<Array<{ id: string; name: string; price: number; description?: string; category?: string }>>(`/restaurants/${slug}/menu`),
      () => supabaseData.getMenu(slug)
    ),

  getRush: (slug: string, partySize = 2) =>
    fetchAPI<{ rush_percentage: number; estimated_wait_minutes: number; rush_level: string }>(
      `/restaurants/${slug}/rush?party_size=${partySize}`
    ).catch(() => ({ rush_percentage: 45, estimated_wait_minutes: 20, rush_level: "moderate" })),

  getCategories: () =>
    withFallback(
      () => fetchAPI<Category[]>("/categories"),
      () => supabaseData.getCategories()
    ),

  getOffers: () =>
    withFallback(
      () => fetchAPI<SpecialOffer[]>("/offers"),
      () => supabaseData.getOffers()
    ),

  getReviews: (slug: string) =>
    fetchAPI<Review[]>(`/restaurants/${slug}/reviews`).catch(() => []),

  createReservation: (data: Record<string, unknown>, token?: string) =>
    fetchAPI<Reservation>("/reservations", {
      method: "POST",
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  createAIReservation: (data: Record<string, unknown>, token?: string) =>
    fetchAPI<Reservation>("/reservations/ai", {
      method: "POST",
      body: JSON.stringify(data),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),

  getMyReservations: (token: string) =>
    fetchAPI<Reservation[]>("/reservations/me", { headers: { Authorization: `Bearer ${token}` } }),

  chat: async (message: string, sessionId?: string, token?: string) => {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId }),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "AI chat request failed");
    }
    return res.json() as Promise<{ role: string; content: string; session_id?: string }>;
  },

  getFavorites: (token: string) =>
    fetchAPI<Array<{ restaurant_id: string }>>("/favorites", { headers: { Authorization: `Bearer ${token}` } }),

  addFavorite: (restaurantId: string, token: string) =>
    fetchAPI<{ status: string }>(`/favorites/${restaurantId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),

  removeFavorite: (restaurantId: string, token: string) =>
    fetchAPI<{ status: string }>(`/favorites/${restaurantId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),

  createReview: (data: Record<string, unknown>, token: string) =>
    fetchAPI<Review>("/reviews", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { Authorization: `Bearer ${token}` },
    }),

  checkIn: (restaurantId: string, partySize: number, token?: string) =>
    fetchAPI<{ id: string; status: string }>("/check-ins", {
      method: "POST",
      body: JSON.stringify({ restaurant_id: restaurantId, party_size: partySize }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
};
