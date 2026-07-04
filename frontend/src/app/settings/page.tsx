"use client";

/** Settings page */

import { Bell, Globe, Moon, Shield } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold text-accent">Settings</h1>

      <div className="mt-6 space-y-6">
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <div>
              <Label>Language</Label>
              <p className="text-sm text-muted-foreground">English / Urdu</p>
            </div>
          </div>
        </section>

        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary" />
            <div>
              <Label>Notifications</Label>
              <p className="text-sm text-muted-foreground">Push notifications (coming soon)</p>
            </div>
          </div>
        </section>

        <Separator />

        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <Label>Privacy</Label>
              <p className="text-sm text-muted-foreground">Your data is encrypted and secure</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
