-- Phone Fantasy — Loans tab: personal loan tracking, separate from the shop's
-- cash flow (not summed into Total Cash / Profit anywhere, same as
-- Gadgets & Accessories — this is a private ledger for the user).
--
-- direction = 'taken'  -> money the user borrowed FROM someone (they owe it back)
-- direction = 'given'  -> money the user lent TO someone (it's owed back to them)
-- The same person can have several concurrent unsettled loans; each entry is
-- independent and is never merged with another.

CREATE TABLE IF NOT EXISTS loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL CHECK (direction IN ('taken', 'given')),
  person_name TEXT NOT NULL,
  amount REAL NOT NULL,
  loan_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  settled_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_loans_direction_status ON loans(direction, status);
CREATE INDEX IF NOT EXISTS idx_loans_date ON loans(loan_date);
