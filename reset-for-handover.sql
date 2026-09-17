-- iPhone Store — full data reset for client handover.
--
-- Wipes every business record (stock, sales, dues, expenses, gadgets,
-- outside deals, loans) back to a clean, empty state. Table STRUCTURE is
-- untouched — only the rows inside are removed — and every auto-increment
-- counter is reset, so the client's very first phone/sale/expense/etc.
-- starts fresh at ID 1 instead of continuing from your test data's numbers.
--
-- Safe to run whether or not migration 0011 (loans ledger) has already
-- been applied — it self-heals the loans schema first, so this single
-- script works either way.
--
-- ⚠ IRREVERSIBLE — this permanently deletes all data. Do not run this on
-- a database you still need the current numbers from.

-- Make sure the current loans-ledger schema exists (harmless no-op if it
-- already does).
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

-- Drop the old one-row-per-loan tables if migration 0011 hasn't run on
-- this database yet (harmless no-op if they're already gone).
DROP TABLE IF EXISTS loan_payments;
DROP TABLE IF EXISTS loans;

-- Wipe every data table (children before parents).
DELETE FROM due_payments;
DELETE FROM sales;
DELETE FROM phones;
DELETE FROM outside_deals;
DELETE FROM expenses;
DELETE FROM expense_categories;
DELETE FROM gadget_sales;
DELETE FROM gadgets;
DELETE FROM loan_entries;
DELETE FROM loan_accounts;

-- Reset every table's auto-increment counter back to 0, so the next
-- inserted row in any table starts at ID 1 again.
DELETE FROM sqlite_sequence;
