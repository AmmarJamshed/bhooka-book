"use client";

/** Search page with natural language queries and filters */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SearchBar } from "@/components/search-bar";
import { QuickFilters } from "@/components/quick-filters";
import { RestaurantCard } from "@/components/restaurant-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

const PAGE_SIZE = 48;

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || undefined;
  const cuisine = searchParams.get("cuisine") || undefined;

  const { data: totalCount } = useQuery({
    queryKey: ["search-count", query, category, cuisine],
    queryFn: () =>
      api.countRestaurants({
        query: query || undefined,
        category,
        city: "karachi",
      }),
  });

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["search", query, category, cuisine],
    queryFn: ({ pageParam = 0 }) =>
      api.searchRestaurants({
        query: query || undefined,
        category,
        cuisine,
        city: "karachi",
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPageParam + PAGE_SIZE,
  });

  const restaurants = data?.pages.flat() ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-accent md:text-3xl">Karachi Restaurants</h1>
      <p className="mt-1 text-muted-foreground">
        Browse {totalCount ? `${totalCount.toLocaleString()} restaurants` : "restaurants"} across Karachi — search by
        name, cuisine, or area
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
        ) : restaurants.length > 0 ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Showing {restaurants.length.toLocaleString()}
              {totalCount ? ` of ${totalCount.toLocaleString()}` : ""} restaurants
            </p>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {restaurants.map((r, i) => (
                <RestaurantCard key={r.id} restaurant={r} index={i} />
              ))}
            </div>
            {hasNextPage && (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading..." : "Load more restaurants"}
                </Button>
              </div>
            )}
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
