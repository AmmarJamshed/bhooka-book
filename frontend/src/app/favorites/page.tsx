"use client";

/** Favorites page */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Heart } from "lucide-react";
import { LinkButton } from "@/components/link-button";
import { RestaurantCard } from "@/components/restaurant-card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores";

export default function FavoritesPage() {
  const token = useAuthStore((s) => s.token);

  const { data: favs } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => api.getFavorites(token!),
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Heart className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">Favorites</h1>
        <p className="mt-2 text-muted-foreground">Sign in to save your favorite restaurants</p>
        <LinkButton href="/profile" className="mt-4 rounded-full">Sign In</LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Heart className="h-6 w-6 text-primary" />
        Favorite Restaurants
      </h1>
      {favs && favs.length > 0 ? (
        <p className="mt-2 text-muted-foreground">{favs.length} saved</p>
      ) : (
        <div className="mt-12 text-center text-muted-foreground">
          <p>No favorites yet. Start exploring!</p>
          <LinkButton href="/search" className="mt-4 rounded-full">Browse Restaurants</LinkButton>
        </div>
      )}
    </div>
  );
}
