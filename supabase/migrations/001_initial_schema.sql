-- Bhooka Book - Initial Database Schema
-- PostgreSQL / Supabase

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums
CREATE TYPE user_role AS ENUM ('user', 'restaurant_owner', 'admin');
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show');
CREATE TYPE rush_level AS ENUM ('quiet', 'moderate', 'busy', 'very_busy');
CREATE TYPE voice_call_status AS ENUM ('initiated', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer');
CREATE TYPE voice_call_outcome AS ENUM ('booked', 'busy', 'rejected', 'alternative_time', 'closed', 'unknown');

-- Cities
CREATE TABLE cities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    province TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories (cuisine types)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    city_id UUID REFERENCES cities(id),
    loyalty_points INT DEFAULT 0,
    preferred_language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restaurants
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES profiles(id),
    city_id UUID REFERENCES cities(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    cuisine TEXT,
    category_id UUID REFERENCES categories(id),
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    phone TEXT,
    email TEXT,
    website TEXT,
    average_price INT,
    rating_avg DECIMAL(3,2) DEFAULT 0,
    review_count INT DEFAULT 0,
    cover_image_url TEXT,
    gallery_urls TEXT[] DEFAULT '{}',
    opening_hours JSONB DEFAULT '{}',
    facilities JSONB DEFAULT '{"parking": false, "wheelchair": false, "prayer_area": false, "outdoor_seating": false, "indoor_seating": true, "family_area": false, "kids_area": false}',
    is_halal BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT false,
    accepts_ai_bookings BOOLEAN DEFAULT true,
    manual_wait_minutes INT,
    google_place_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_restaurants_city ON restaurants(city_id);
CREATE INDEX idx_restaurants_category ON restaurants(category_id);
CREATE INDEX idx_restaurants_location ON restaurants(latitude, longitude);
CREATE INDEX idx_restaurants_name_trgm ON restaurants USING gin(name gin_trgm_ops);

-- Menu items
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price INT NOT NULL,
    category TEXT,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservations
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    guest_name TEXT NOT NULL,
    guest_phone TEXT NOT NULL,
    party_size INT NOT NULL CHECK (party_size > 0 AND party_size <= 50),
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    status reservation_status DEFAULT 'pending',
    special_requests TEXT,
    preferences JSONB DEFAULT '{}',
    is_ai_booking BOOLEAN DEFAULT false,
    voice_call_id UUID,
    confirmation_code TEXT UNIQUE,
    estimated_wait_minutes INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_restaurant ON reservations(restaurant_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date, reservation_time);

-- Reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    reservation_id UUID REFERENCES reservations(id),
    food_rating INT CHECK (food_rating BETWEEN 1 AND 5),
    service_rating INT CHECK (service_rating BETWEEN 1 AND 5),
    ambience_rating INT CHECK (ambience_rating BETWEEN 1 AND 5),
    value_rating INT CHECK (value_rating BETWEEN 1 AND 5),
    overall_rating DECIMAL(3,2),
    review_text TEXT,
    photo_urls TEXT[] DEFAULT '{}',
    helpful_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, restaurant_id, reservation_id)
);

-- Favorites
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, restaurant_id)
);

-- Check-ins (anonymous occupancy tracking)
CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    checked_out_at TIMESTAMPTZ,
    party_size INT DEFAULT 1
);

CREATE INDEX idx_check_ins_restaurant ON check_ins(restaurant_id, checked_in_at);

-- Rush history (proprietary rush score)
CREATE TABLE rush_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hour_of_day INT NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    rush_percentage DECIMAL(5,2) NOT NULL,
    estimated_wait_minutes INT,
    confidence_score DECIMAL(5,2) DEFAULT 0.5,
    rush_level rush_level,
    source TEXT DEFAULT 'forecast',
    reservation_count INT DEFAULT 0,
    check_in_count INT DEFAULT 0,
    serp_popularity INT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_rush_history_restaurant ON rush_history(restaurant_id, recorded_at DESC);

-- SERP traffic snapshots (daily 1pm scrape)
CREATE TABLE serp_traffic_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    google_place_id TEXT,
    popular_times JSONB,
    current_popularity INT,
    rating DECIMAL(3,2),
    review_count INT,
    raw_data JSONB
);

-- Voice calls (AI reservation calls)
CREATE TABLE voice_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID REFERENCES reservations(id),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    user_id UUID REFERENCES profiles(id),
    twilio_call_sid TEXT,
    status voice_call_status DEFAULT 'initiated',
    outcome voice_call_outcome,
    duration_seconds INT,
    recording_url TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI conversation logs
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    voice_call_id UUID REFERENCES voice_calls(id),
    session_id TEXT,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_session ON ai_conversations(session_id, created_at);

-- Chat sessions (AI concierge)
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications (future FCM)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    type TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Special offers
CREATE TABLE special_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    discount_percent INT,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE rush_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE serp_traffic_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Public read for cities, categories, approved restaurants
CREATE POLICY "Cities are viewable by everyone" ON cities FOR SELECT USING (is_active = true);
CREATE POLICY "Categories are viewable by everyone" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "Approved restaurants are viewable" ON restaurants FOR SELECT USING (is_approved = true AND is_active = true);
CREATE POLICY "Menu items viewable for approved restaurants" ON menu_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM restaurants r WHERE r.id = restaurant_id AND r.is_approved = true)
);
CREATE POLICY "Rush history viewable by everyone" ON rush_history FOR SELECT USING (true);
CREATE POLICY "Special offers viewable" ON special_offers FOR SELECT USING (is_active = true);
CREATE POLICY "Reviews viewable by everyone" ON reviews FOR SELECT USING (true);

-- Profile policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Reservation policies
CREATE POLICY "Users view own reservations" ON reservations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create reservations" ON reservations FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users update own reservations" ON reservations FOR UPDATE USING (auth.uid() = user_id);

-- Favorites
CREATE POLICY "Users manage own favorites" ON favorites FOR ALL USING (auth.uid() = user_id);

-- Reviews
CREATE POLICY "Users create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id);

-- Check-ins
CREATE POLICY "Users manage own check-ins" ON check_ins FOR ALL USING (auth.uid() = user_id);

-- Chat
CREATE POLICY "Users manage own chat sessions" ON chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own chat messages" ON chat_messages FOR ALL USING (
    EXISTS (SELECT 1 FROM chat_sessions cs WHERE cs.id = session_id AND cs.user_id = auth.uid())
);

-- Notifications
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Seed data: Pakistan cities and categories
INSERT INTO cities (name, slug, province, latitude, longitude) VALUES
    ('Karachi', 'karachi', 'Sindh', 24.8607, 67.0011),
    ('Lahore', 'lahore', 'Punjab', 31.5204, 74.3587),
    ('Islamabad', 'islamabad', 'ICT', 33.6844, 73.0479),
    ('Rawalpindi', 'rawalpindi', 'Punjab', 33.5651, 73.0169),
    ('Faisalabad', 'faisalabad', 'Punjab', 31.4504, 73.1350);

INSERT INTO categories (name, slug, icon, sort_order) VALUES
    ('Chinese', 'chinese', '🥡', 1),
    ('BBQ', 'bbq', '🍖', 2),
    ('Desi', 'desi', '🍛', 3),
    ('Seafood', 'seafood', '🦐', 4),
    ('Cafe', 'cafe', '☕', 5),
    ('Fine Dining', 'fine-dining', '🍷', 6),
    ('Family', 'family', '👨‍👩‍👧‍👦', 7),
    ('Buffet', 'buffet', '🍽️', 8);
