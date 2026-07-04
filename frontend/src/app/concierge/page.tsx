"use client";

/** AI Concierge chat interface */

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useChatStore, useAuthStore } from "@/stores";

const SUGGESTIONS = [
  "Find a rooftop restaurant near Clifton",
  "Show halal BBQ restaurants",
  "Find restaurants with parking",
  "Show restaurants with low waiting time",
  "Recommend dinner tonight in Lahore",
  "Show best burgers in Karachi",
];

export default function ConciergePage() {
  const { messages, isLoading, addMessage, setLoading, sessionId, setSessionId } = useChatStore();
  const token = useAuthStore((s) => s.token);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    addMessage({ role: "user", content: text });
    setLoading(true);
    inputRef.current!.value = "";

    try {
      const res = await api.chat(text, sessionId ?? undefined, token ?? undefined);
      if (res.session_id) setSessionId(res.session_id);
      addMessage({ role: "assistant", content: res.content });
    } catch {
      addMessage({ role: "assistant", content: "Sorry, I'm having trouble connecting. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col px-4 py-4">
      <div className="mb-4 text-center">
        <Bot className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-2 text-2xl font-bold text-accent">AI Concierge</h1>
        <p className="text-sm text-muted-foreground">Ask in English or Urdu — I understand both</p>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto rounded-2xl glass p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">How can I help you dine today?</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="rounded-full border border-primary/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
          >
            {msg.role === "assistant" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-white"
                  : "bg-white/80 text-accent"
              }`}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                <User className="h-4 w-4 text-accent" />
              </div>
            )}
          </motion.div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <div className="rounded-2xl bg-white/80 px-4 py-2.5 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(inputRef.current?.value || "");
        }}
        className="mt-4 flex gap-2"
      >
        <Input
          ref={inputRef}
          placeholder="Ask me anything about restaurants..."
          className="flex-1 rounded-full border-0 bg-white/80 shadow"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" className="rounded-full bg-primary hover:bg-primary/90" disabled={isLoading}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
