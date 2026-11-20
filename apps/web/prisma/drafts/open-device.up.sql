-- Store-native open device credentials (self-enrolled, isolated per device).
-- Separate from the threadly_beta_* synthetic-test lane, which stays invitation-only.
-- Apply with: psql "$DATABASE_URL" -f prisma/drafts/open-device.up.sql

CREATE TABLE IF NOT EXISTS threadly_open_device (
    token_hash     TEXT PRIMARY KEY,          -- sha256 of the bearer token; the token itself is never stored
    guest_id       TEXT NOT NULL UNIQUE,      -- 'dev-<48 hex>' server-issued identity
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL,      -- issued at +90 days; client re-enrolls silently after expiry
    request_count  INTEGER NOT NULL DEFAULT 0, -- hard cap 2000 enforced in the UPDATE ... WHERE
    revoked        BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS threadly_open_device_guest ON threadly_open_device (guest_id);

-- Singleton global enrollment rate limiter (30/min), independent of spoofable IP headers.
CREATE TABLE IF NOT EXISTS threadly_open_enrollment (
    singleton           BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    enrollment_attempts INTEGER NOT NULL DEFAULT 0,
    enrollment_window   TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO threadly_open_enrollment (singleton) VALUES (true) ON CONFLICT DO NOTHING;
