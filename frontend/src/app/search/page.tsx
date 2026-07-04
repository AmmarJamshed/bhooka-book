"use client";

/** Search page with natural language queries and filters */

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SearchBar } from "@/components/search-bar";
import { QuickFilters } from "@/components/quick-filters";
import { RestaurantCard } from "@/components/restaurant-card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || undefined;
  const cuisine = searchParams.get("cuisine") || undefined;

  const { data: restaurants, isLoading } = useQuery({
    queryKey: ["search", query, category, cuisine],
    queryFn: () =>
      api.searchRestaurants({
        query: query || undefined,
        category,
        cuisine,
        limit: 24,
      }),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-accent md:text-3xl">Find Your Perfect Spot</h1>
      <p className="mt-1 text-muted-foreground">
        Search by name, cuisine, area, or ask naturally — &quot;Chinese food under Rs.4000&quot;
      </p>

      <div className="mt-6">
        <SearchBar />
      </div>
      <div className="mt-4">
        <QuickFilters />
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : restaurants && restaurants.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">{restaurants.length} restaurants found</p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {restaurants.map((r, i) => (
                <RestaurantCard key={r.id} restaurant={r} index={i} />
              ))}
            </div>
          </>
        ) : (
          <div className="glass rounded-2xl p-12 text-center">
            <p className="text-lg text-muted-foreground">No restaurants found. Try a different search.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8"><Skeleton className="h-96 rounded-2xl" /></div>}>
      <SearchContent />
    </Suspense>
  );
}
