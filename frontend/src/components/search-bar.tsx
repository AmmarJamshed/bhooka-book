"use client";

/** Hero search bar for landing page */

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchBar({ large = false }: { large?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/search?${params}`);
  };

  return (
    <form onSubmit={handleSearch} className={`flex gap-2 ${large ? "max-w-2xl" : "max-w-xl"} w-full`}>
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try "rooftop restaurant near Clifton" or "Chinese under Rs.4000"'
          className={`rounded-full border-0 bg-white/90 pl-12 shadow-lg backdrop-blur ${large ? "h-14 text-base" : "h-11"}`}
        />
      </div>
      <Button type="submit" className={`rounded-full bg-primary px-6 hover:bg-primary/90 ${large ? "h-14" : "h-11"}`}>
        Search
      </Button>
    </form>
  );
}
