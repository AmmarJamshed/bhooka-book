import { NextResponse } from "next/server";
import { buildOpeningTwiml, getPublicBaseUrl } from "@/lib/voice-agent";

export const runtime = "nodejs";

/** Inbound Twilio webhook — demo restaurant booking (no trial outbound message) */
export async function POST(request: Request) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const ctx = {
    guestName: "Ammar",
    partySize: 3,
    restaurant: "Kolachi Restaurant",
    date,
    time: "8:00 PM",
    step: "ask" as const,
    mode: "inbound" as const,
  };

  const twiml = buildOpeningTwiml(ctx, getPublicBaseUrl(request));
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}

export async function GET(request: Request) {
  return POST(request);
}
