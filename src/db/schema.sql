CREATE TABLE IF NOT EXISTS leads (
  id           SERIAL PRIMARY KEY,
  wa_chat_id   TEXT UNIQUE NOT NULL,
  person_name  TEXT,
  company_name TEXT,
  industry     TEXT,
  legal_need   TEXT,
  status       TEXT NOT NULL DEFAULT 'new',
  confidence   REAL,
  needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id         SERIAL PRIMARY KEY,
  lead_id    INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction  TEXT NOT NULL CHECK (direction IN ('in','out')),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,        -- format: scrypt$N$r$p$saltHex$hashHex
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,        -- token acak 32-byte (base64url), opaque
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
