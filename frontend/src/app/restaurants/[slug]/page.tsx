"use client";

/** Restaurant detail page */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Clock, MapPin, Phone, Star, Bot, CalendarCheck } from "lucide-react";
import { RushIndicator } from "@/components/rush-indicator";
import { LinkButton } from "@/components/link-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

const FACILITY_LABELS: Record<string, string> = {
  parking: "Parking",
  wheelchair: "Wheelchair Access",
  prayer_area: "Prayer Area",
  outdoor_seating: "Outdoor Seating",
  indoor_seating: "Indoor Seating",
  family_area: "Family Area",
  kids_area: "Kids Area",
};

export default function RestaurantDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant", slug],
    queryFn: () => api.getRestaurant(slug),
  });

  const { data: menu } = useQuery({
    queryKey: ["menu", slug],
    queryFn: () => api.getMenu(slug),
    enabled: !!slug,
  });

  const { data: reviews } = useQuery({
    queryKey: ["reviews", slug],
    queryFn: () => api.getReviews(slug),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="mt-4 h-8 w-1/2" />
        <Skeleton className="mt-2 h-4 w-1/3" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Restaurant not found</h1>
        <LinkButton href="/search" className="mt-4">Back to search</LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Hero image */}
      <div className="relative aspect-[21/9] overflow-hidden rounded-3xl">
        <img
          src={restaurant.cover_image_url || `https://picsum.photos/seed/${slug}/1200/500`}
          alt={restaurant.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Header info */}
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-accent">{restaurant.name}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{restaurant.cuisine}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-primary text-primary" />
              {restaurant.rating_avg.toFixed(1)} ({restaurant.review_count} reviews)
            </span>
            {restaurant.address && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {restaurant.address}
              </span>
            )}
            {restaurant.average_price && (
              <span className="font-medium">Avg. Rs.{restaurant.average_price.toLocaleString()}</span>
            )}
          </div>
          {restaurant.rush && <div className="mt-3"><RushIndicator rush={restaurant.rush} /></div>}
        </div>

        <div className="flex gap-2">
          <LinkButton href={`/restaurants/${slug}/reserve`} className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground">
            <CalendarCheck className="mr-2 h-4 w-4" />
            Reserve
          </LinkButton>
          {restaurant.accepts_ai_bookings && (
            <LinkButton href={`/restaurants/${slug}/reserve?ai=true`} variant="outline" className="rounded-full border-primary text-primary">
              <Bot className="mr-2 h-4 w-4" />
              AI Reserve
            </LinkButton>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="about" className="mt-8">
        <TabsList className="rounded-full bg-white/70 backdrop-blur">
          <TabsTrigger value="about" className="rounded-full">About</TabsTrigger>
          <TabsTrigger value="menu" className="rounded-full">Menu</TabsTrigger>
          <TabsTrigger value="reviews" className="rounded-full">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="about" className="mt-6">
          <div className="glass rounded-2xl p-6">
            <p className="text-muted-foreground">{restaurant.description || "A wonderful dining experience awaits."}</p>
            {restaurant.phone && (
              <p className="mt-4 flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-primary" />
                {restaurant.phone}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(restaurant.facilities || {})
                .filter(([, v]) => v)
                .map(([key]) => (
                  <Badge key={key} variant="secondary" className="rounded-full">
                    {FACILITY_LABELS[key] || key}
                  </Badge>
                ))}
              {restaurant.is_halal && (
                <Badge className="rounded-full bg-success/10 text-success">Halal</Badge>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="menu" className="mt-6">
          <div className="grid gap-3">
            {menu && menu.length > 0 ? (
              menu.map((item) => (
                <div key={item.id} className="glass flex items-center justify-between rounded-xl p-4">
                  <div>
                    <h4 className="font-medium">{item.name}</h4>
                    {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                  </div>
                  <span className="font-semibold text-primary">Rs.{item.price.toLocaleString()}</span>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">Menu coming soon</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <div className="grid gap-4">
            {reviews && reviews.length > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="glass rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-primary text-primary" />
                    <span className="font-medium">{review.overall_rating?.toFixed(1)}</span>
                  </div>
                  {review.review_text && <p className="mt-2 text-sm text-muted-foreground">{review.review_text}</p>}
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No reviews yet. Be the first!</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
