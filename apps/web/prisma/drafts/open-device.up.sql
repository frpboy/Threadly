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
CREATE INDEX IF NOT EXISTS threadly_open_device_expiry ON threadly_open_device (expires_at);

-- Retention model:
-- * Self-deletion (DELETE /api/player-data) hard-deletes the device row and every
--   gameplay/receipt row for the identity in one transaction; nothing is retained.
-- * The revoked flag exists only for administrative abuse revocation, not self-deletion.
-- * Automatic purge (purgeExpiredOpenDevices, run on each enrollment, capped batch):
--   90-day credential + 30-day self-deletion grace, then the identity AND ALL its
--   data (device row, guesses, streaks, stats, leaderboard entries, receipts) are
--   deleted in one transaction. Nothing strands; no operator action required.

-- Guess-idempotency receipts for credentialed play (both open and legacy-beta devices).
-- Intentionally no FK: identities live in threadly_open_device OR threadly_beta_device;
-- lifecycle cleanup happens in deleteIdentityData (same transaction as data delete),
-- never via cascades. The legacy threadly_beta_request name is retired: its FK to
-- threadly_beta_device(guest_id) would reject every 'dev-*' store player.
CREATE TABLE IF NOT EXISTS threadly_guess_receipt (
    guest_id     TEXT NOT NULL,
    request_id   UUID NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    result       JSONB NOT NULL,
    PRIMARY KEY (guest_id, request_id)
);

-- Singleton global enrollment rate limiter (30/min), independent of spoofable IP headers.
CREATE TABLE IF NOT EXISTS threadly_open_enrollment (
    singleton           BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton),
    enrollment_attempts INTEGER NOT NULL DEFAULT 0,
    enrollment_window   TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO threadly_open_enrollment (singleton) VALUES (true) ON CONFLICT DO NOTHING;
