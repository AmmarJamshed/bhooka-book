/** Server-side AI concierge — Groq + Supabase restaurant context */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fpyfshycjtqqrfggvcay.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const SYSTEM_PROMPT = `You are Bhooka Book AI — Pakistan's AI Restaurant Concierge.

You help users:
- Discover restaurants across Pakistan (Karachi, Lahore, Islamabad, etc.)
- Book table reservations
- Suggest alternatives when restaurants are busy
- Answer questions about cuisine, halal options, parking, prayer areas, and pricing
- Understand both English and Urdu (Roman Urdu)

Be polite, concise, and helpful. When suggesting restaurants, mention cuisine, area, estimated wait, and price range when known.
For booking requests, collect: name, phone, party size, date, time, and special preferences.
Currency is Pakistani Rupees (Rs.).

When restaurant data is provided in context, recommend specific places from that list with brief reasons.
If a city has limited listings in our database, say so honestly and still give helpful general dining advice for that city.`;

const CITY_ALIASES: Record<string, string> = {
  karachi: "karachi",
  lahore: "lahore",
  islamabad: "islamabad",
  rawalpindi: "islamabad",
  pindi: "islamabad",
};

const CUISINE_KEYWORDS: Array<{ match: RegExp; label: string }> = [
  { match: /\bbbq\b|barbecue|barbeque|grill/i, label: "BBQ" },
  { match: /chinese|ginsoy|cocochan/i, label: "Chinese" },
  { match: /seafood|fish|crab/i, label: "Seafood" },
  { match: /cafe|coffee|brunch/i, label: "Cafe" },
  { match: /buffet/i, label: "Buffet" },
  { match: /fine dining|upscale|romantic/i, label: "Fine Dining" },
  { match: /burger/i, label: "Fast Food" },
  { match: /desi|pakistani|biryani|karahi|nihari|bbq/i, label: "Desi" },
];

type SearchHints = {
  city: string;
  cuisine?: string;
};

export function extractSearchHints(message: string): SearchHints {
  const lower = message.toLowerCase();
  let city = "karachi";
  for (const [alias, slug] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) {
      city = slug;
      break;
    }
  }

  let cuisine: string | undefined;
  for (const { match, label } of CUISINE_KEYWORDS) {
    if (match.test(message)) {
      cuisine = label;
      break;
    }
  }

  return { city, cuisine };
}

async function fetchRestaurantContext(hints: SearchHints): Promise<string> {
  if (!SUPABASE_ANON_KEY) return "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: cityRow } = await supabase.from("cities").select("id, name").eq("slug", hints.city).single();
  if (!cityRow) return "";

  let query = supabase
    .from("restaurants")
    .select("name, cuisine, address, rating_avg, review_count, average_price")
    .eq("city_id", cityRow.id)
    .eq("is_active", true)
    .eq("is_approved", true)
    .order("rating_avg", { ascending: false })
    .order("review_count", { ascending: false })
    .limit(10);

  if (hints.cuisine) {
    query = query.ilike("cuisine", `%${hints.cuisine}%`);
  }

  const { data: restaurants } = await query;
  if (!restaurants?.length) {
    return `City: ${cityRow.name}\nNo matching restaurants found in our database for this query.`;
  }

  const lines = restaurants.map((r) => {
    const price = r.average_price ? `Rs.${r.average_price}` : "price varies";
    return `- ${r.name} (${r.cuisine || "Restaurant"}) — ★${r.rating_avg} (${r.review_count} reviews), ${price}. ${r.address || ""}`;
  });

  return `City: ${cityRow.name}\nTop matching restaurants in Bhooka Book:\n${lines.join("\n")}`;
}

export async function generateConciergeReply(message: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return "AI concierge is not configured yet. Please add GROQ_API_KEY to the server environment.";
  }

  const hints = extractSearchHints(message);
  const context = await fetchRestaurantContext(hints);
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: context ? `${SYSTEM_PROMPT}\n\nContext:\n${context}` : SYSTEM_PROMPT,
        },
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Groq API error: ${response.status} ${detail.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content?.trim() || "I couldn't generate a response. Please try again.";
}
