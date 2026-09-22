-- iPhone Store — one-off fix for the remote (production) D1 database's
-- migration bookkeeping, round 2.
--
-- Same root cause as fix-remote-migrations-tracking.sql (carried over from
-- the Phone Fantasy handoff): wrangler's own bookkeeping table
-- (d1_migrations) doesn't have every migration file 0001-0017 recorded as
-- applied, even though their real effects (columns, tables) already exist
-- in this live database — all 17 were confirmed run successfully earlier.
-- Because of that gap, `wrangler d1 migrations apply --remote` tries to
-- re-run early ones like 0003_phones_buy_fields.sql, which fails with
-- "duplicate column name: ram_rom" since that column is already there.
--
-- This just tells wrangler "these are already applied" so a fresh
-- `migrations apply --remote` only touches genuinely new migrations
-- (0018_buy_seller_photos.sql and onward). It does NOT touch any real
-- business data (phones/sales/cash/etc).
--
-- Run once with:
--   npx wrangler d1 execute iphone-store-db --remote --file=fix-remote-migrations-tracking-2.sql
-- Then:
--   npx wrangler d1 migrations apply iphone-store-db --remote
-- (it should now only apply 0018_buy_seller_photos.sql)

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
  ('0016_cash_adjustment_4.sql'),
  ('0017_outside_stock.sql');
