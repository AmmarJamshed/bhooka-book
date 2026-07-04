import { NextResponse } from "next/server";
import { buildOpeningTwiml } from "@/lib/voice-agent";

export const runtime = "nodejs";

type CallRequest = {
  to?: string;
  guestName?: string;
  partySize?: number;
  restaurant?: string;
  date?: string;
  time?: string;
};

/** Initiate outbound conversational voice booking call */
export async function POST(request: Request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ detail: "Twilio is not configured on the server" }, { status: 503 });
  }

  const body = (await request.json()) as CallRequest;
  const to = body.to?.trim();
  if (!to) {
    return NextResponse.json({ detail: "Phone number (to) is required" }, { status: 400 });
  }

  const guestName = body.guestName || "Ammar";
  const partySize = body.partySize || 3;
  const restaurant = body.restaurant || "Kolachi Restaurant";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date =
    body.date ||
    tomorrow.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const time = body.time || "8:00 PM";

  const baseUrl = "https://bhooka-book.netlify.app";

  const ctx = {
    guestName,
    partySize,
    restaurant,
    date,
    time,
    step: "ask" as const,
  };

  const inlineTwiml = buildOpeningTwiml(ctx, baseUrl);
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const form = new URLSearchParams({
    To: to,
    From: fromNumber,
    Twiml: inlineTwiml,
    Record: "true",
  });

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );

  const payload = await twilioRes.json();
  if (!twilioRes.ok) {
    return NextResponse.json(
      { detail: payload.message || "Failed to initiate call" },
      { status: twilioRes.status }
    );
  }

  return NextResponse.json({
    call_sid: payload.sid,
    status: payload.status,
    to,
    note: "Twilio trial accounts play a short prompt first — press any key on your phone to hear the booking agent.",
  });
}
