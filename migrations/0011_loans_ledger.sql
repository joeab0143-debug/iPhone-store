-- iPhone Store — Loans as a per-person running ledger instead of one row
-- per transaction. Taking/giving a loan to the same person (same
-- direction) now merges into a single account so the Loans tab shows one
-- line per person with a running balance, and tapping in shows the full
-- timeline of every amount taken/given and every repayment.
--
-- Also: loan cash flow now affects Total Cash (previously it was a private
-- ledger, deliberately excluded) — see app/api/dashboard/route.ts.
--   ধার নিলে      -> Total Cash এ যোগ
--   ধার পরিশোধ করলে -> Total Cash থেকে বিয়োগ
--   ধার দিলে      -> Total Cash থেকে বিয়োগ
--   ধার আদায় হলে   -> Total Cash এ যোগ

CREATE TABLE IF NOT EXISTS loan_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL CHECK (direction IN ('taken', 'given')),
  person_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE(direction, person_name)
);

CREATE TABLE IF NOT EXISTS loan_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('disburse', 'repay')),
  amount REAL NOT NULL,
  entry_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_loan_entries_account ON loan_entries(account_id);

-- Migrate whatever is already sitting in the old one-row-per-loan tables
-- into the new per-person ledger. Exact (direction, person_name) matches
-- merge into one account; anything typed with different spelling/casing
-- before this migration stays separate (going forward, new entries match
-- case-insensitively — see app/api/loans/route.ts).
INSERT INTO loan_accounts (direction, person_name, created_at)
SELECT direction, person_name, MIN(created_at)
FROM loans
GROUP BY direction, person_name;

INSERT INTO loan_entries (account_id, kind, amount, entry_date, created_at)
SELECT la.id, 'disburse', l.amount, l.loan_date, l.created_at
FROM loans l
JOIN loan_accounts la ON la.direction = l.direction AND la.person_name = l.person_name;

INSERT INTO loan_entries (account_id, kind, amount, entry_date, note, created_at)
SELECT la.id, 'repay', lp.amount, lp.paid_date, lp.note, lp.created_at
FROM loan_payments lp
JOIN loans l ON l.id = lp.loan_id
JOIN loan_accounts la ON la.direction = l.direction AND la.person_name = l.person_name;

DROP TABLE loan_payments;
DROP TABLE loans;
