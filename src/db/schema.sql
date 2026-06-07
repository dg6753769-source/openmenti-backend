-- ============================================================
-- OpenMenti Artist Music Platform — PostgreSQL Schema (Supabase)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('fan', 'artist', 'admin')) DEFAULT 'fan',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ARTIST PROFILES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artist_profiles (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bio                         TEXT,
  genre                       TEXT,
  living_room_price_paise     INTEGER DEFAULT 19900,  -- ₹199/month default
  living_room_description     TEXT,
  social_links                JSONB DEFAULT '{}',
  razorpay_linked_account_id  TEXT,                  -- for split routing
  total_streams               INTEGER DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TRACKS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id         UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  storage_key       TEXT NOT NULL,        -- R2 object key for audio file
  hls_playlist_key  TEXT,                 -- R2 key for HLS master playlist (after transcoding)
  cover_art_url     TEXT,
  is_vault          BOOLEAN NOT NULL DEFAULT FALSE,
  price_paise       INTEGER DEFAULT 0,   -- price for vault unlock
  duration_seconds  INTEGER,
  play_count        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_vault ON tracks(is_vault);

-- ─────────────────────────────────────────────
-- TRANSACTIONS (single source of truth for all money)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                      UUID PRIMARY KEY,
  fan_id                  UUID NOT NULL REFERENCES users(id),
  artist_id               UUID REFERENCES artist_profiles(id),
  track_id                UUID REFERENCES tracks(id),
  type                    TEXT NOT NULL CHECK (type IN ('tip', 'vault_unlock', 'living_room_sub', 'album_purchase')),
  amount_paise            INTEGER NOT NULL,
  artist_payout_paise     INTEGER,
  platform_fee_paise      INTEGER,
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  split_status            TEXT NOT NULL DEFAULT 'pending' CHECK (split_status IN ('pending', 'routed', 'failed', 'not_applicable')),
  split_error             TEXT,
  razorpay_order_id       TEXT UNIQUE,
  razorpay_payment_id     TEXT UNIQUE,
  razorpay_transfer_id    TEXT,
  razorpay_subscription_id TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_fan ON transactions(fan_id);
CREATE INDEX IF NOT EXISTS idx_transactions_artist ON transactions(artist_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- ─────────────────────────────────────────────
-- VAULT ACCESS (fan has unlocked a specific track)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vault_access (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id         UUID NOT NULL REFERENCES users(id),
  track_id       UUID NOT NULL REFERENCES tracks(id),
  transaction_id UUID REFERENCES transactions(id),
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ,            -- NULL = permanent access
  UNIQUE(fan_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_access_fan ON vault_access(fan_id);

-- ─────────────────────────────────────────────
-- FAN MEMBERSHIPS (living room subscriptions)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fan_memberships (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fan_id                    UUID NOT NULL REFERENCES users(id),
  artist_id                 UUID NOT NULL REFERENCES artist_profiles(id),
  tier                      TEXT NOT NULL DEFAULT 'living_room',
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_end        TIMESTAMPTZ NOT NULL,
  transaction_id            UUID REFERENCES transactions(id),
  razorpay_subscription_id  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fan_id, artist_id)
);

-- ─────────────────────────────────────────────
-- FAN FOLLOWS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fan_follows (
  fan_id      UUID NOT NULL REFERENCES users(id),
  artist_id   UUID NOT NULL REFERENCES artist_profiles(id),
  followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fan_id, artist_id)
);

-- ─────────────────────────────────────────────
-- STREAM EVENTS (analytics)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stream_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id         UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('play', 'skip', 'complete', 'vault_play')),
  duration_seconds INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stream_events_track ON stream_events(track_id);
CREATE INDEX IF NOT EXISTS idx_stream_events_created ON stream_events(created_at);

-- ─────────────────────────────────────────────
-- LIVING ROOM CONTENT (exclusive media for members)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS living_room_content (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id   UUID NOT NULL REFERENCES artist_profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('voice_note', 'demo_track', 'livestream', 'studio_session')),
  description TEXT,
  storage_key TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- WEBHOOK EVENTS (idempotency log)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  razorpay_event  TEXT NOT NULL,
  payload         JSONB NOT NULL,
  processed       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (Supabase RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE fan_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE living_room_content ENABLE ROW LEVEL SECURITY;

-- Users: read own profile only
CREATE POLICY "users_read_own" ON users FOR SELECT USING (auth.uid()::TEXT = id::TEXT);

-- Artist profiles: public read, owner write
CREATE POLICY "artist_profiles_public_read" ON artist_profiles FOR SELECT USING (TRUE);
CREATE POLICY "artist_profiles_owner_write" ON artist_profiles FOR ALL USING (auth.uid()::TEXT = user_id::TEXT);

-- Tracks: public tracks readable by all; vault tracks require vault_access row
CREATE POLICY "tracks_public_read" ON tracks FOR SELECT USING (is_vault = FALSE);
CREATE POLICY "tracks_vault_read" ON tracks FOR SELECT USING (
  is_vault = TRUE AND EXISTS (
    SELECT 1 FROM vault_access va
    WHERE va.track_id = tracks.id AND va.fan_id::TEXT = auth.uid()::TEXT
      AND (va.expires_at IS NULL OR va.expires_at > NOW())
  )
);

-- Vault access: fan sees own rows only
CREATE POLICY "vault_access_own" ON vault_access FOR SELECT USING (auth.uid()::TEXT = fan_id::TEXT);

-- Fan memberships: fan sees own rows only
CREATE POLICY "fan_memberships_own" ON fan_memberships FOR SELECT USING (auth.uid()::TEXT = fan_id::TEXT);

-- Transactions: fan sees own, artist sees their incoming
CREATE POLICY "transactions_fan_read" ON transactions FOR SELECT USING (auth.uid()::TEXT = fan_id::TEXT);

-- Living room content: members only
CREATE POLICY "living_room_members_only" ON living_room_content FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM fan_memberships fm
    WHERE fm.artist_id = living_room_content.artist_id
      AND fm.fan_id::TEXT = auth.uid()::TEXT
      AND fm.status = 'active'
      AND fm.current_period_end > NOW()
  )
);
