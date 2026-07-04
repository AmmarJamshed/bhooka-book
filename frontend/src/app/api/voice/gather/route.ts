import { NextResponse } from "next/server";
import {
  buildOutcomeTwiml,
  getPublicBaseUrl,
  interpretRestaurantReply,
  parseBookingContext,
} from "@/lib/voice-agent";

export const runtime = "nodejs";

/** Twilio webhook — handle spoken restaurant reply */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const ctx = parseBookingContext(url.searchParams);
  const form = await request.formData();
  const speech = (form.get("SpeechResult")?.toString() || "").trim();
  const digits = form.get("Digits")?.toString() || "";
  const baseUrl = getPublicBaseUrl(request);

  if (digits === "1") {
    const twiml = buildOutcomeTwiml("confirmed", ctx, baseUrl);
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  }
  if (digits === "2") {
    const twiml = buildOutcomeTwiml("alternative", ctx, baseUrl);
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  }
  if (digits === "3") {
    const twiml = buildOutcomeTwiml("rejected", ctx, baseUrl);
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  if (!speech) {
    const twiml = buildOutcomeTwiml("unclear", ctx, baseUrl);
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  const { outcome, note } = await interpretRestaurantReply(speech, ctx);

  if (ctx.step === "alternative" && (outcome === "confirmed" || /yes|sure|ok|confirm|theek|haan/i.test(speech))) {
    const twiml = buildOutcomeTwiml("confirmed", ctx, baseUrl, note);
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  const twiml = buildOutcomeTwiml(outcome, ctx, baseUrl, note);
  return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
}
