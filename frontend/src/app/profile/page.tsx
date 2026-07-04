"use client";

/** User profile and auth */

import { useEffect, useMemo, useState } from "react";
import { User, LogOut, Heart, Calendar, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase";
import { useAuthStore } from "@/stores";

export default function ProfilePage() {
  const { user, setUser, logout } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(
          { id: session.user.id, email: session.user.email, name: session.user.user_metadata?.full_name },
          session.access_token
        );
      }
    });
  }, [setUser, supabase.auth]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          setUser({ id: data.user!.id, email }, data.session.access_token);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUser({ id: data.user.id, email: data.user.email }, data.session.access_token);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
  };

  if (user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <div className="glass rounded-2xl p-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <User className="h-10 w-10 text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">{user.name || "Food Lover"}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>

        <div className="mt-6 space-y-2">
          {[
            { href: "/reservations", icon: Calendar, label: "My Reservations" },
            { href: "/favorites", icon: Heart, label: "Favorites" },
            { href: "/settings", icon: Settings, label: "Settings" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="glass flex items-center gap-3 rounded-xl p-4 transition-colors hover:bg-primary/5">
              <Icon className="h-5 w-5 text-primary" />
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </div>

        <Button onClick={handleLogout} variant="outline" className="mt-6 w-full rounded-full">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center text-2xl font-bold">{isSignUp ? "Create Account" : "Sign In"}</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">Join Bhooka Book to save favorites and track reservations</p>

      <form onSubmit={handleAuth} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 rounded-xl" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 rounded-xl" />
        </div>
        <Button type="submit" disabled={loading} className="w-full rounded-full bg-primary">
          {loading ? "..." : isSignUp ? "Sign Up" : "Sign In"}
        </Button>
      </form>

      <button onClick={() => setIsSignUp(!isSignUp)} className="mt-4 w-full text-center text-sm text-primary hover:underline">
        {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
      </button>
    </div>
  );
}
