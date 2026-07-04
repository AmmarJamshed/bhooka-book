"use client";

/** Admin dashboard */

import { Bot, Building2, Phone, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-accent">Admin Dashboard</h1>
      <p className="text-muted-foreground">Platform overview and management</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Restaurants", value: "—", icon: Building2 },
          { label: "Users", value: "—", icon: Users },
          { label: "AI Calls Today", value: "—", icon: Phone },
          { label: "Booking Success", value: "—", icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="glass border-0">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="glass border-0">
          <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />AI Usage</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Groq API calls, chat sessions, and voice agent metrics.</p></CardContent>
        </Card>
        <Card className="glass border-0">
          <CardHeader><CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-primary" />Voice Call Logs</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground">Twilio call recordings and reservation success rates.</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
