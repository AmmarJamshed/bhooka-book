"""Groq-powered AI concierge for restaurant discovery and booking."""

from groq import Groq

from app.core.config import get_settings

SYSTEM_PROMPT = """You are Bhooka Book AI — Pakistan's AI Restaurant Concierge.

You help users:
- Discover restaurants across Pakistan (Karachi, Lahore, Islamabad, etc.)
- Book table reservations
- Suggest alternatives when restaurants are busy
- Answer questions about cuisine, halal options, parking, prayer areas, and pricing
- Understand both English and Urdu (Roman Urdu)

Be polite, concise, and helpful. When suggesting restaurants, mention cuisine, area, estimated wait, and price range when known.
For booking requests, collect: name, phone, party size, date, time, and special preferences.
Currency is Pakistani Rupees (Rs.).

If you don't have specific data, be honest and suggest the user search on Bhooka Book."""

settings = get_settings()


class AIService:
    """Groq LLM integration for chat and voice agent reasoning."""

    def __init__(self) -> None:
        self.client = Groq(api_key=settings.GROQ_API_KEY) if settings.GROQ_API_KEY else None
        self.model = settings.GROQ_MODEL

    async def chat(
        self,
        messages: list[dict[str, str]],
        context: str | None = None,
    ) -> str:
        """Generate a chat response using Groq."""
        if not self.client:
            return "AI service is not configured. Please set GROQ_API_KEY."

        system = SYSTEM_PROMPT
        if context:
            system += f"\n\nContext:\n{context}"

        full_messages = [{"role": "system", "content": system}, *messages]

        response = self.client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            temperature=0.7,
            max_tokens=1024,
        )
        return response.choices[0].message.content or ""

    async def parse_search_intent(self, query: str) -> dict:
        """Extract structured search parameters from natural language."""
        if not self.client:
            return {"query": query}

        prompt = f"""Extract restaurant search intent from this query. Return JSON with keys:
query, cuisine, city, area, max_price, min_rating, max_rush, party_size, booking_intent (bool).
Query: "{query}"
Only return valid JSON, no markdown."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=256,
        )
        import json

        try:
            return json.loads(response.choices[0].message.content or "{}")
        except json.JSONDecodeError:
            return {"query": query}

    async def generate_voice_script(
        self,
        restaurant_name: str,
        guest_name: str,
        party_size: int,
        date_str: str,
        time_str: str,
        preferences: dict,
    ) -> str:
        """Generate the opening script for AI voice reservation call."""
        prefs = ", ".join(k.replace("_", " ") for k, v in preferences.items() if v)
        return (
            f"Assalam o Alaikum, I'm calling from Bhooka Book on behalf of {guest_name}. "
            f"We'd like to book a table for {party_size} at {restaurant_name} "
            f"on {date_str} at {time_str}."
            + (f" Special requests: {prefs}." if prefs else "")
            + " Is that available?"
        )

    async def interpret_call_outcome(self, transcript: str) -> dict:
        """Analyze call transcript to determine booking outcome."""
        if not self.client:
            return {"outcome": "unknown", "summary": transcript}

        prompt = f"""Analyze this restaurant reservation call transcript.
Determine outcome: booked, busy, rejected, alternative_time, closed, or unknown.
Return JSON with keys: outcome, summary, alternative_time (if any), confirmation_details.
Transcript: {transcript}"""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=512,
        )
        import json

        try:
            return json.loads(response.choices[0].message.content or "{}")
        except json.JSONDecodeError:
            return {"outcome": "unknown", "summary": transcript}


ai_service = AIService()
