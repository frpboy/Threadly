-- DRAFT: ONLY a verified NEW EMPTY isolated synthetic test database.
-- Not a production migration. Never run against inherited/live DATABASE_URL.
BEGIN;
CREATE TABLE threadly_beta_target (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  target_id text NOT NULL UNIQUE CHECK (target_id LIKE 'threadly-native-beta-%'),
  synthetic_only boolean NOT NULL CHECK (synthetic_only),
  expires_at timestamptz NOT NULL,
  enrollment_window timestamptz NOT NULL DEFAULT now(),
  enrollment_attempts integer NOT NULL DEFAULT 0
);
CREATE TABLE threadly_beta_invitation (
  code_hash char(64) PRIMARY KEY CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  target_id text NOT NULL REFERENCES threadly_beta_target(target_id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE TABLE threadly_beta_device (
  token_hash char(64) PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  invitation_hash char(64) NOT NULL UNIQUE REFERENCES threadly_beta_invitation(code_hash),
  guest_id text NOT NULL UNIQUE,
  target_id text NOT NULL REFERENCES threadly_beta_target(target_id),
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count BETWEEN 0 AND 2000)
);

-- Apply this additional table in the SAME approved empty test target only.
CREATE TABLE threadly_beta_request (
  guest_id text NOT NULL REFERENCES threadly_beta_device(guest_id),
  request_id uuid NOT NULL,
  payload_hash char(64) NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (guest_id, request_id)
);

COMMIT;
