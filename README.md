# Bhooka Book 🍽️

**Pakistan's AI Restaurant Concierge** — Discover restaurants, check live busyness, reserve tables, and let our AI voice agent call restaurants for you.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Next.js PWA    │────▶│  FastAPI Backend │────▶│  Supabase PG    │
│  (Netlify)      │     │  (Render)        │     │  + Auth         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │                        ├── Groq (AI Chat)       │
        │                        ├── Twilio (Voice)      │
        │                        └── SERP (Daily Scrape)  │
        └──────────────── Supabase Auth ──────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, PWA |
| State | Zustand, React Query |
| Backend | Python FastAPI, SQLAlchemy, Alembic |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (JWT) |
| AI | Groq API (Llama 3.3 70B) |
| Voice | Twilio + Groq Whisper + Piper TTS |
| Maps | Google Maps API |
| Traffic | SERP API (daily 1pm PKT scrape + forecasting) |

## Quick Start

### Prerequisites

- Node.js 22+
- Python 3.11+
- Supabase project (connected via Cursor MCP)

### 1. Database Setup

Apply migrations to your Supabase project:

```bash
# Via Supabase SQL Editor or MCP
# Run: supabase/migrations/001_initial_schema.sql
# Then: supabase/migrations/002_seed_restaurants.sql
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env          # Fill in your keys
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # Fill in Supabase keys
npm run dev
```

App: http://localhost:3000

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for all required keys:

- `GROQ_API_KEY` — AI chat and voice reasoning
- `TWILIO_*` — AI reservation phone calls
- `SUPABASE_*` — Database and authentication
- `SERP_API_KEY` — Daily Google Maps traffic scrape
- `GOOGLE_MAPS_API_KEY` — Maps integration

## Features

### Core
- **Restaurant Discovery** — Search by name, cuisine, area, or natural language
- **Rush Score** — Proprietary busyness prediction (not Google Popular Times)
- **Reservations** — Standard and AI-powered voice booking
- **AI Concierge** — ChatGPT-style assistant (English + Urdu)
- **Reviews & Favorites** — Rate and save restaurants
- **Check-in/Check-out** — Anonymous occupancy tracking

### Rush Prediction Engine
Combines reservation counts, check-ins, historical data, and daily SERP snapshots (1pm PKT) to forecast busyness for the entire day.

### AI Voice Pipeline
```
User Request → FastAPI → Twilio Call → Groq Whisper → Groq LLM → Piper TTS → Restaurant
```

### PWA
- Installable on mobile/desktop
- Offline support via service worker
- App shortcuts (Search, AI Concierge, Reservations)

## Deployment

### Frontend (Netlify)
```bash
# Connect repo, set base directory to "frontend"
# Add env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
# netlify.toml is pre-configured
```

### Backend (Render)
```bash
# Use render.yaml blueprint or create Web Service
# Set root directory to "backend"
# Add all backend env vars
```

### Daily SERP Scraper (GitHub Actions)
Runs daily at 1pm PKT. Set repository secrets:
- `SERP_API_KEY`
- `DATABASE_URL`

## Pages

| Page | Route |
|------|-------|
| Landing | `/` |
| Search | `/search` |
| Restaurant Details | `/restaurants/[slug]` |
| Reservation | `/restaurants/[slug]/reserve` |
| AI Concierge | `/concierge` |
| Profile | `/profile` |
| My Reservations | `/reservations` |
| Favorites | `/favorites` |
| Settings | `/settings` |
| Restaurant Dashboard | `/dashboard/restaurant` |
| Admin Dashboard | `/dashboard/admin` |

## Security

- JWT authentication via Supabase
- Rate limiting (100 req/min)
- Row Level Security on all Supabase tables
- Input validation via Pydantic
- HTTPS only in production
- Secrets via environment variables (never committed)

## License

Proprietary — Bhooka Book © 2026
