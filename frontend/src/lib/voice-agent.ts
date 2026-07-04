/** Conversational Twilio voice agent for restaurant bookings */

export type BookingContext = {
  guestName: string;
  partySize: number;
  restaurant: string;
  date: string;
  time: string;
  step: "ask" | "retry" | "alternative";
};

export type CallOutcome = "confirmed" | "rejected" | "alternative" | "unclear";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function parseBookingContext(params: URLSearchParams): BookingContext {
  const step = params.get("step");
  return {
    guestName: params.get("guestName") || "Guest",
    partySize: Number(params.get("partySize") || "2"),
    restaurant: params.get("restaurant") || "the restaurant",
    date: params.get("date") || "today",
    time: params.get("time") || "7:00 PM",
    step: step === "retry" || step === "alternative" ? step : "ask",
  };
}

export function bookingQueryString(ctx: BookingContext): string {
  const q = new URLSearchParams({
    guestName: ctx.guestName,
    partySize: String(ctx.partySize),
    restaurant: ctx.restaurant,
    date: ctx.date,
    time: ctx.time,
    step: ctx.step,
  });
  return q.toString();
}

function gatherBlock(actionUrl: string, retryUrl: string, prompt: string): string {
  return `<Gather input="speech dtmf" action="${escapeXml(actionUrl)}" method="POST" speechTimeout="auto" timeout="10" language="en-IN" hints="yes,no,confirmed,available,not available,busy,alternative,ok,sure,cancel,one,two,three" numDigits="1">
    <Say voice="Polly.Aditi">${escapeXml(prompt)}</Say>
  </Gather>
  <Say voice="Polly.Aditi">I did not hear a response. Let me try once more.</Say>
  <Redirect method="POST">${escapeXml(retryUrl)}</Redirect>`;
}

export function buildOpeningTwiml(ctx: BookingContext, baseUrl: string): string {
  const actionUrl = `${baseUrl}/api/voice/gather?${bookingQueryString({ ...ctx, step: "ask" })}`;
  const retryUrl = `${baseUrl}/api/voice/twiml?${bookingQueryString({ ...ctx, step: "retry" })}`;

  let opening: string;
  if (ctx.step === "retry") {
    opening = `Sorry, I did not catch that clearly. I am calling from Bhooka Book to book a table for ${ctx.partySize} guests under the name ${ctx.guestName} on ${ctx.date} at ${ctx.time}. Is that available? Please say yes or no.`;
  } else if (ctx.step === "alternative") {
    opening = `Thank you. What alternative date or time would work for a table of ${ctx.partySize} under ${ctx.guestName}?`;
  } else {
    opening = `Thank you for taking the call. Assalam o Alaikum. This is the Bhooka Book AI assistant. I am calling on behalf of ${ctx.guestName} to book a table for ${ctx.partySize} people at ${ctx.restaurant} on ${ctx.date} at ${ctx.time}. Do you have availability? Please say yes or no.`;
  }

  const gatherAction =
    ctx.step === "alternative"
      ? `${baseUrl}/api/voice/gather?${bookingQueryString({ ...ctx, step: "alternative" })}`
      : actionUrl;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${gatherBlock(gatherAction, retryUrl, opening)}
</Response>`;
}

export function buildOutcomeTwiml(
  outcome: CallOutcome,
  ctx: BookingContext,
  baseUrl: string,
  alternativeNote?: string
): string {
  switch (outcome) {
    case "confirmed":
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Wonderful! The reservation is confirmed for ${ctx.partySize} guests under the name ${ctx.guestName} on ${ctx.date} at ${ctx.time}. Shukriya, and thank you very much. Goodbye.</Say>
  <Hangup/>
</Response>`;

    case "rejected":
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">I understand. Thank you for letting me know. We will inform ${ctx.guestName}. Goodbye.</Say>
  <Hangup/>
</Response>`;

    case "alternative": {
      const actionUrl = `${baseUrl}/api/voice/gather?${bookingQueryString({ ...ctx, step: "alternative" })}`;
      const retryUrl = `${baseUrl}/api/voice/twiml?${bookingQueryString({ ...ctx, step: "alternative" })}`;
      const note = alternativeNote ? `I heard: ${alternativeNote}. ` : "";
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${gatherBlock(actionUrl, retryUrl, `${note}Could you please confirm the alternative time for ${ctx.partySize} guests under ${ctx.guestName}? Say yes to confirm or no if it will not work.`)}
</Response>`;
    }

    case "unclear":
    default: {
      const retryUrl = `${baseUrl}/api/voice/twiml?${bookingQueryString({ ...ctx, step: "retry" })}`;
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${escapeXml(retryUrl)}</Redirect>
</Response>`;
    }
  }
}

export async function interpretRestaurantReply(
  speech: string,
  ctx: BookingContext
): Promise<{ outcome: CallOutcome; note?: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const lower = speech.toLowerCase();
    if (/yes|sure|ok|confirm|available|book|done|theek|haan|ji/.test(lower)) return { outcome: "confirmed" };
    if (/no|not|busy|full|closed|cancel|nahi/.test(lower)) return { outcome: "rejected" };
    if (/alternative|instead|try|pm|am|tomorrow|later|time/.test(lower)) return { outcome: "alternative", note: speech };
    return { outcome: "unclear" };
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const prompt = `You analyze a restaurant staff member's spoken reply during a phone reservation call.

Booking request: table for ${ctx.partySize} under ${ctx.guestName} on ${ctx.date} at ${ctx.time} at ${ctx.restaurant}.
Conversation step: ${ctx.step}
Staff reply: "${speech}"

Return ONLY valid JSON with keys:
- outcome: one of "confirmed", "rejected", "alternative", "unclear"
- note: short summary if alternative time/date was suggested, else empty string

Rules:
- confirmed = they agree to book / table is available
- rejected = no table / cannot accommodate / declined
- alternative = they propose a different time or date
- unclear = greeting, hold, unrelated, or ambiguous`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    return { outcome: "unclear" };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content?.trim() || "{}";

  try {
    const parsed = JSON.parse(raw) as { outcome?: CallOutcome; note?: string };
    const outcome = parsed.outcome || "unclear";
    if (outcome === "confirmed" || outcome === "rejected" || outcome === "alternative" || outcome === "unclear") {
      return { outcome, note: parsed.note || undefined };
    }
    return { outcome: "unclear" };
  } catch {
    return { outcome: "unclear" };
  }
}

export function getPublicBaseUrl(request: Request): string {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.URL ||
    (() => {
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") || "https";
      return host ? `${proto}://${host}` : "https://bhooka-book.netlify.app";
    })()
  );
}
