-- iPhone Store — one-off fix for the remote (production) D1 database's
-- migration bookkeeping.
--
-- What happened: `wrangler d1 migrations list iphone-store-db --remote`
-- shows EVERY migration file (0001 through 0016) as still "pending", even
-- though their actual effects (columns, tables, cash adjustments) are
-- already present in the live production data. Running
-- `wrangler d1 migrations apply --remote` in that state would try to
-- re-execute all of them from scratch:
--   - 0001 is idempotent (CREATE TABLE ... IF NOT EXISTS), so it would
--     no-op harmlessly.
--   - 0002, 0003, 0010, and similar plain `ALTER TABLE ... ADD COLUMN`
--     migrations have no "IF NOT EXISTS" option in SQLite, so they fail
--     outright with "duplicate column name" — which is the error you
--     already hit (both 0002's outside_deals.ram_rom and 0003's
--     phones.ram_rom columns already exist, so it's ambiguous which of the
--     two actually tripped it, but either way the batch stopped early).
--   - 0013-0016 are NOT safe to re-run at all: they do
--     `UPDATE cash_adjustments SET amount = amount + <delta>`, so running
--     them again would silently ADD those correction amounts a second time
--     and quietly corrupt your live Total Cash figure. The batch happened
--     to stop at 0002/0003 before reaching these, so nothing has been
--     double-applied yet.
--
-- The fix: tell wrangler's own bookkeeping table that 0001-0016 are
-- already applied (their real effects already exist in this database), so
-- future `migrations apply --remote` runs only touch genuinely new
-- migrations (starting with 0017_outside_stock.sql).
--
-- This does NOT touch any of your business data (phones/sales/cash/etc.) —
-- it only records history in wrangler's own d1_migrations table.
--
-- Run once with:
--   npx wrangler d1 execute iphone-store-db --remote --file=fix-remote-migrations-tracking.sql
--
-- Then confirm with:
--   npx wrangler d1 migrations list iphone-store-db --remote
-- (it should now show ONLY 0017_outside_stock.sql as pending), and only
-- then run:
--   npx wrangler d1 migrations apply iphone-store-db --remote

CREATE TABLE IF NOT EXISTS d1_migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO d1_migrations (name) VALUES
  ('0001_init.sql'),
  ('0002_buy_sell_split.sql'),
  ('0003_phones_buy_fields.sql'),
  ('0004_gadgets.sql'),
  ('0005_sales_extra_fields.sql'),
  ('0006_phones_imei_reuse.sql'),
  ('0007_gadgets_rework.sql'),
  ('0008_loans.sql'),
  ('0009_loan_payments.sql'),
  ('0010_phones_battery_health.sql'),
  ('0011_loans_ledger.sql'),
  ('0012_auth.sql'),
  ('0013_cash_adjustment.sql'),
  ('0014_cash_adjustment_2.sql'),
  ('0015_cash_adjustment_3.sql'),
  ('0016_cash_adjustment_4.sql');
