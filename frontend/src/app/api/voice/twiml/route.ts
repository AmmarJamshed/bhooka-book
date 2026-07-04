import { NextResponse } from "next/server";
import {
  buildOpeningTwiml,
  getPublicBaseUrl,
  parseBookingContext,
} from "@/lib/voice-agent";

export const runtime = "nodejs";

/** Twilio webhook — start conversational booking call */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const ctx = parseBookingContext(url.searchParams);
  const twiml = buildOpeningTwiml(ctx, getPublicBaseUrl(request));
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}

export async function GET(request: Request) {
  return POST(request);
}
