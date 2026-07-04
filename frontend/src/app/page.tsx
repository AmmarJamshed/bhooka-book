"use client";

/** Landing page — hero, search, trending, nearby, offers */

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, TrendingUp, MapPin, Tag } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { QuickFilters } from "@/components/quick-filters";
import { RestaurantCard } from "@/components/restaurant-card";
import { LinkButton } from "@/components/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export default function HomePage() {
  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ["trending"],
    queryFn: () => api.getTrending(),
  });

  const { data: offers } = useQuery({
    queryKey: ["offers"],
    queryFn: () => api.getOffers(),
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,107,0,0.08),transparent_50%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              AI-Powered Dining
            </span>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-accent md:text-6xl">
              Bhooka Book
            </h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              Pakistan&apos;s AI Restaurant Concierge
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Discover restaurants · Live rush forecasts · Reserve tables · Call to book
            </p>
          </motion.div>

          <motion.div
            className="mt-8 flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <SearchBar large />
          </motion.div>

          <motion.div
            className="mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <QuickFilters />
          </motion.div>

          <motion.div
            className="mt-6 flex justify-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <LinkButton href="/concierge" variant="outline" className="rounded-full">
              Ask AI Concierge
            </LinkButton>
          </motion.div>
        </div>
      </section>

      {/* Trending */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-bold text-accent">
            <TrendingUp className="h-6 w-6 text-primary" />
            Trending Restaurants
          </h2>
          <Link href="/search" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {trendingLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))
            : trending?.map((r, i) => <RestaurantCard key={r.id} restaurant={r} index={i} />)}
        </div>
      </section>

      {/* Special Offers */}
      {offers && offers.length > 0 && (
        <section className="bg-accent/5 px-4 py-12">
          <div className="mx-auto max-w-7xl">
            <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-accent">
              <Tag className="h-6 w-6 text-primary" />
              Special Offers & Card Discounts
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer) => (
                <Link
                  key={offer.id}
                  href={`/restaurants/${offer.restaurant.slug}`}
                  className="glass rounded-2xl p-5 transition-all hover:shadow-xl"
                >
                  <h3 className="font-semibold text-accent">{offer.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{offer.restaurant.name}</p>
                  {offer.card_name && (
                    <p className="mt-1 text-xs font-medium text-primary">{offer.card_name}</p>
                  )}
                  {offer.discount_percent && (
                    <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      {offer.discount_percent}% off
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 text-center">
        <div className="glass mx-auto max-w-2xl rounded-3xl p-8 md:p-12">
          <MapPin className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-2xl font-bold text-accent">Dine Smarter</h2>
          <p className="mt-2 text-muted-foreground">
            Check live rush forecasts after 1pm, browse card discounts from Peekaboo Guru, and call restaurants directly to book.
          </p>
          <LinkButton href="/concierge" className="mt-6 rounded-full bg-primary px-8 hover:bg-primary/90 text-primary-foreground">
            Try AI Concierge
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
