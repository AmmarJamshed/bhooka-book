"""Point Twilio number to inbound voice demo webhook."""

import os

from twilio.rest import Client

WEBHOOK = os.environ.get("VOICE_WEBHOOK_URL", "https://bhooka-book.netlify.app/api/voice/incoming")

account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]

client = Client(account_sid, auth_token)

for number in client.incoming_phone_numbers.list(limit=5):
    number.update(voice_url=WEBHOOK, voice_method="POST")
    print(f"Updated {number.phone_number} -> {WEBHOOK}")

print("\nCall +1 754-291-6596 from your phone to test the booking agent.")
print("No Twilio trial message plays on inbound calls.")
