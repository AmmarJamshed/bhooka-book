/** Global Zustand stores for Bhooka Book */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "@/types";

interface SearchState {
  query: string;
  cuisine: string | null;
  category: string | null;
  setQuery: (q: string) => void;
  setCuisine: (c: string | null) => void;
  setCategory: (c: string | null) => void;
  reset: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  cuisine: null,
  category: null,
  setQuery: (query) => set({ query }),
  setCuisine: (cuisine) => set({ cuisine }),
  setCategory: (category) => set({ category }),
  reset: () => set({ query: "", cuisine: null, category: null }),
}));

interface ChatState {
  messages: ChatMessage[];
  sessionId: string | null;
  isLoading: boolean;
  addMessage: (msg: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  setSessionId: (id: string) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  sessionId: null,
  isLoading: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setLoading: (isLoading) => set({ isLoading }),
  setSessionId: (sessionId) => set({ sessionId }),
  clear: () => set({ messages: [], sessionId: null }),
}));

interface AuthState {
  user: { id: string; email?: string; name?: string } | null;
  token: string | null;
  setUser: (user: AuthState["user"], token?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user, token) => set({ user, token: token ?? null }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: "bhooka-auth" }
  )
);

interface FavoritesState {
  favorites: Set<string>;
  setFavorites: (ids: string[]) => void;
  toggle: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: new Set(),
  setFavorites: (ids) => set({ favorites: new Set(ids) }),
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.favorites);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { favorites: next };
    }),
  isFavorite: (id) => get().favorites.has(id),
}));
