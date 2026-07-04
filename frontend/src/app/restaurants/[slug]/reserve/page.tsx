"use client";

/** Reservation form — standard and AI booking */

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Bot, CalendarCheck, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { LinkButton } from "@/components/link-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores";

function ReserveForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const isAI = searchParams.get("ai") === "true";
  const token = useAuthStore((s) => s.token);

  const [form, setForm] = useState({
    guest_name: "",
    guest_phone: "",
    party_size: 2,
    reservation_date: "",
    reservation_time: "",
    special_requests: "",
    preferences: {
      birthday: false,
      wheelchair: false,
      baby_chair: false,
      outdoor: false,
      window_seat: false,
      smoking: false,
      non_smoking: true,
    },
  });
  const [confirmed, setConfirmed] = useState<{ code?: string; ai?: boolean } | null>(null);

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant", slug],
    queryFn: () => api.getRestaurant(slug),
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isAI ? api.createAIReservation(data, token ?? undefined) : api.createReservation(data, token ?? undefined),
    onSuccess: (res) => {
      setConfirmed({ code: res.confirmation_code, ai: res.is_ai_booking });
      toast.success(isAI ? "AI is calling the restaurant!" : "Reservation confirmed!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    mutation.mutate({
      restaurant_id: restaurant.id,
      ...form,
      is_ai_booking: isAI,
    });
  };

  const togglePref = (key: keyof typeof form.preferences) => {
    setForm((f) => ({
      ...f,
      preferences: { ...f.preferences, [key]: !f.preferences[key] },
    }));
  };

  if (confirmed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-success" />
        <h1 className="mt-4 text-2xl font-bold">
          {confirmed.ai ? "AI Reservation Initiated" : "Reservation Confirmed!"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {confirmed.ai
            ? "Our AI voice agent is calling the restaurant. You'll receive a confirmation shortly."
            : `Your confirmation code: ${confirmed.code}`}
        </p>
        <LinkButton href="/reservations" className="mt-6 rounded-full">
          View My Reservations
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        {isAI ? <Bot className="h-8 w-8 text-primary" /> : <CalendarCheck className="h-8 w-8 text-primary" />}
        <div>
          <h1 className="text-2xl font-bold">{isAI ? "AI Reservation" : "Reserve a Table"}</h1>
          <p className="text-muted-foreground">{restaurant?.name}</p>
        </div>
      </div>

      {isAI && (
        <div className="mb-6 rounded-xl bg-primary/5 p-4 text-sm text-muted-foreground">
          Our AI will call the restaurant on your behalf using voice AI. You&apos;ll get a confirmation once the call completes.
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass space-y-4 rounded-2xl p-6">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" required value={form.guest_name} onChange={(e) => setForm({ ...form, guest_name: e.target.value })} className="mt-1 rounded-xl" />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" required type="tel" value={form.guest_phone} onChange={(e) => setForm({ ...form, guest_phone: e.target.value })} className="mt-1 rounded-xl" placeholder="+92 3XX XXXXXXX" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="party">People</Label>
            <Input id="party" type="number" min={1} max={50} value={form.party_size} onChange={(e) => setForm({ ...form, party_size: parseInt(e.target.value) })} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" required value={form.reservation_date} onChange={(e) => setForm({ ...form, reservation_date: e.target.value })} className="mt-1 rounded-xl" />
          </div>
        </div>
        <div>
          <Label htmlFor="time">Time</Label>
          <Input id="time" type="time" required value={form.reservation_time} onChange={(e) => setForm({ ...form, reservation_time: e.target.value })} className="mt-1 rounded-xl" />
        </div>
        <div>
          <Label htmlFor="requests">Special Requests</Label>
          <Textarea id="requests" value={form.special_requests} onChange={(e) => setForm({ ...form, special_requests: e.target.value })} className="mt-1 rounded-xl" />
        </div>

        <div>
          <Label>Preferences</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(form.preferences).map(([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => togglePref(key as keyof typeof form.preferences)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  val ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-primary/10"
                }`}
              >
                {key.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={mutation.isPending} className="w-full rounded-full bg-primary hover:bg-primary/90">
          {mutation.isPending ? "Processing..." : isAI ? "Start AI Reservation Call" : "Confirm Reservation"}
        </Button>
      </form>
    </div>
  );
}

export default function ReservePage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <ReserveForm />
    </Suspense>
  );
}
