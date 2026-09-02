-- Login system for handing the app over to the client: a single-user
-- username/password gate, changeable from inside the app.
--
-- app_credentials holds exactly one row (id is CHECK-constrained to 1) —
-- there's only ever one login for the whole shop.
CREATE TABLE IF NOT EXISTS app_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Default login seeded here so the app is usable immediately after this
-- migration runs. Username: admin  Password: PhoneFantasy@2026
-- (PBKDF2-SHA256, 100,000 iterations, 32-byte hash, 16-byte salt — see
-- lib/auth.ts). Change this from inside the app before handing it over.
INSERT INTO app_credentials (id, username, password_hash, password_salt)
VALUES (
  1,
  'admin',
  '271771813587a4ecbf79444b9a9b86eb655d3bfa478e8798789aa0fc91d45f82',
  '09f2a14599ca7551a08436414ff421d7'
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS app_sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_expires ON app_sessions(expires_at);
