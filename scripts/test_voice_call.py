"""Initiate conversational voice booking call via deployed API."""

import json
import urllib.request

API = "https://bhooka-book.netlify.app/api/voice/call"
PAYLOAD = {
    "to": "+923392003473",
    "guestName": "Ammar",
    "partySize": 3,
    "restaurant": "Kolachi Restaurant",
    "time": "8:00 PM",
}

req = urllib.request.Request(
    API,
    data=json.dumps(PAYLOAD).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=30) as res:
    print(res.read().decode())
