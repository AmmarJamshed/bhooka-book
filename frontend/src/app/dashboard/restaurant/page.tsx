"use client";

/** Restaurant owner dashboard */

import { BarChart3, Calendar, Clock, Star, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function RestaurantDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-accent">Restaurant Dashboard</h1>
      <p className="text-muted-foreground">Manage your restaurant profile, reservations, and analytics</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Today's Reservations", value: "12", icon: Calendar },
          { label: "Current Wait", value: "25 min", icon: Clock },
          { label: "Rating", value: "4.5", icon: Star },
          { label: "Peak Hour", value: "8 PM", icon: BarChart3 },
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

      <Tabs defaultValue="reservations" className="mt-8">
        <TabsList>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        <TabsContent value="reservations">
          <Card className="glass border-0 mt-4">
            <CardHeader><CardTitle>Pending Reservations</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Connect your restaurant to see reservations here.</p></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="menu">
          <Card className="glass border-0 mt-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Menu Management</CardTitle>
              <Upload className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent><p className="text-muted-foreground">Upload and manage your menu items.</p></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics">
          <Card className="glass border-0 mt-4">
            <CardHeader><CardTitle>Peak Hours & Occupancy</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Analytics powered by Bhooka Book Rush Score.</p></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
