"use client";

/** Reusable restaurant card with rush indicator */

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, MapPin, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/link-button";
import { Card, CardContent } from "@/components/ui/card";
import type { Restaurant } from "@/types";
import { RUSH_COLORS, RUSH_LABELS } from "@/types";

interface RestaurantCardProps {
  restaurant: Restaurant;
  index?: number;
}

export function RestaurantCard({ restaurant, index = 0 }: RestaurantCardProps) {
  const rush = restaurant.rush;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Card className="group overflow-hidden border-0 bg-white/70 shadow-lg backdrop-blur-md transition-all hover:shadow-xl hover:-translate-y-1">
        <Link href={`/restaurants/${restaurant.slug}`}>
          <div className="relative aspect-[16/10] overflow-hidden">
            <img
              src={restaurant.cover_image_url || `https://picsum.photos/seed/${restaurant.slug}/600/400`}
              alt={restaurant.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            {restaurant.is_open !== false && (
              <Badge className="absolute left-3 top-3 bg-success text-white">Open Now</Badge>
            )}
            {rush && (
              <Badge className={`absolute right-3 top-3 border ${RUSH_COLORS[rush.rush_level]}`}>
                {RUSH_LABELS[rush.rush_level]}
              </Badge>
            )}
          </div>
        </Link>

        <CardContent className="p-4">
          <Link href={`/restaurants/${restaurant.slug}`}>
            <h3 className="text-lg font-semibold text-accent group-hover:text-primary transition-colors">
              {restaurant.name}
            </h3>
          </Link>
          <p className="text-sm text-muted-foreground">{restaurant.cuisine}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              {restaurant.rating_avg.toFixed(1)} ({restaurant.review_count})
            </span>
            {restaurant.distance_km != null && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {restaurant.distance_km} km
              </span>
            )}
            {rush && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                ~{rush.estimated_wait_minutes} min wait
              </span>
            )}
          </div>

          {restaurant.average_price && (
            <p className="mt-1 text-sm font-medium text-accent">
              Avg. Rs.{restaurant.average_price.toLocaleString()}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <LinkButton href={`/restaurants/${restaurant.slug}/reserve`} className="flex-1 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Reserve
            </LinkButton>
            <LinkButton href={`/restaurants/${restaurant.slug}/reserve?ai=true`} variant="outline" className="flex-1 rounded-full border-primary text-primary hover:bg-primary/5">
              <Users className="mr-1 h-4 w-4" />
              AI Reserve
            </LinkButton>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
