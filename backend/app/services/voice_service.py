"""Twilio voice integration for AI restaurant reservation calls."""

import secrets
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from twilio.rest import Client

from app.core.config import get_settings
from app.models import (
    Reservation,
    ReservationStatus,
    Restaurant,
    VoiceCall,
    VoiceCallOutcome,
    VoiceCallStatus,
)
from app.services.ai_service import ai_service

settings = get_settings()


def generate_confirmation_code() -> str:
    """Generate a 6-character alphanumeric confirmation code."""
    return secrets.token_hex(3).upper()


class VoiceService:
    """Handles AI-powered phone calls to restaurants via Twilio."""

    def __init__(self) -> None:
        self.client = (
            Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
            if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN
            else None
        )
        self.from_number = settings.TWILIO_PHONE_NUMBER

    async def initiate_reservation_call(
        self,
        db: AsyncSession,
        reservation: Reservation,
        restaurant: Restaurant,
    ) -> VoiceCall:
        """Start an outbound call to the restaurant for AI booking."""
        voice_call = VoiceCall(
            reservation_id=reservation.id,
            restaurant_id=restaurant.id,
            user_id=reservation.user_id,
            status=VoiceCallStatus.INITIATED,
            started_at=datetime.utcnow(),
        )
        db.add(voice_call)
        await db.flush()

        if not self.client or not restaurant.phone:
            voice_call.status = VoiceCallStatus.FAILED
            reservation.status = ReservationStatus.PENDING
            return voice_call

        # TwiML webhook URL — configure in production with your Render backend URL
        webhook_base = settings.CORS_ORIGINS.split(",")[0].replace("3000", "8000")
        twiml_url = f"{webhook_base}/api/v1/voice/twiml/{voice_call.id}"

        try:
            call = self.client.calls.create(
                to=restaurant.phone,
                from_=self.from_number,
                url=twiml_url,
                record=True,
                status_callback=f"{webhook_base}/api/v1/voice/status/{voice_call.id}",
                status_callback_event=["completed", "answered", "no-answer"],
            )
            voice_call.twilio_call_sid = call.sid
            voice_call.status = VoiceCallStatus.RINGING
        except Exception:
            voice_call.status = VoiceCallStatus.FAILED

        return voice_call

    async def handle_call_completed(
        self,
        db: AsyncSession,
        voice_call_id: UUID,
        transcript: str,
    ) -> Reservation | None:
        """Process completed call: interpret outcome and update reservation."""
        voice_call = await db.get(VoiceCall, voice_call_id)
        if not voice_call:
            return None

        result = await ai_service.interpret_call_outcome(transcript)
        outcome_str = result.get("outcome", "unknown")

        outcome_map = {
            "booked": VoiceCallOutcome.BOOKED,
            "busy": VoiceCallOutcome.BUSY,
            "rejected": VoiceCallOutcome.REJECTED,
            "alternative_time": VoiceCallOutcome.ALTERNATIVE_TIME,
            "closed": VoiceCallOutcome.CLOSED,
        }
        voice_call.outcome = outcome_map.get(outcome_str, VoiceCallOutcome.UNKNOWN)
        voice_call.status = VoiceCallStatus.COMPLETED
        voice_call.ended_at = datetime.utcnow()

        reservation = await db.get(Reservation, voice_call.reservation_id)
        if not reservation:
            return None

        if voice_call.outcome == VoiceCallOutcome.BOOKED:
            reservation.status = ReservationStatus.CONFIRMED
            reservation.confirmation_code = generate_confirmation_code()
        elif voice_call.outcome in (VoiceCallOutcome.REJECTED, VoiceCallOutcome.CLOSED):
            reservation.status = ReservationStatus.REJECTED
        else:
            reservation.status = ReservationStatus.PENDING

        return reservation

    def generate_twiml_greeting(
        self,
        restaurant_name: str,
        guest_name: str,
        party_size: int,
        date_str: str,
        time_str: str,
    ) -> str:
        """Generate TwiML for the outbound call greeting."""
        message = (
            f"Assalam o Alaikum. This is Bhooka Book calling on behalf of {guest_name}. "
            f"We would like to reserve a table for {party_size} people at {restaurant_name} "
            f"on {date_str} at {time_str}. Press 1 to confirm, 2 for alternative time, 3 to decline."
        )
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Zeina">{message}</Say>
    <Gather numDigits="1" action="/api/v1/voice/gather" method="POST" timeout="10">
        <Say voice="Polly.Zeina">Please press a key.</Say>
    </Gather>
</Response>"""


voice_service = VoiceService()
