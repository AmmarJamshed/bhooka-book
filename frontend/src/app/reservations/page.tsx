"use client";

/** User reservations list */

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/link-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
};

export default function ReservationsPage() {
  const token = useAuthStore((s) => s.token);

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["my-reservations"],
    queryFn: () => api.getMyReservations(token!),
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">My Reservations</h1>
        <p className="mt-2 text-muted-foreground">Sign in to view your reservations</p>
        <LinkButton href="/profile" className="mt-4 rounded-full">Sign In</LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-accent">My Reservations</h1>

      {isLoading ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : reservations && reservations.length > 0 ? (
        <div className="mt-6 space-y-4">
          {reservations.map((r) => (
            <div key={r.id} className="glass rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{r.guest_name} — Party of {r.party_size}</p>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{r.reservation_date}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.reservation_time}</span>
                  </div>
                  {r.confirmation_code && (
                    <p className="mt-2 text-sm font-mono text-primary">Code: {r.confirmation_code}</p>
                  )}
                  {r.is_ai_booking && (
                    <Badge variant="secondary" className="mt-2">AI Booking</Badge>
                  )}
                </div>
                <Badge className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 text-center text-muted-foreground">
          <p>No reservations yet.</p>
          <LinkButton href="/search" className="mt-4 rounded-full">Find a restaurant</LinkButton>
        </div>
      )}
    </div>
  );
}
