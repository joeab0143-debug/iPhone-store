-- History of phones returned to whoever they were bought from (a
-- Supplier, or an individual "Used Phone" seller) -- see the new "Return
-- to Supplier" button in app/components/StockTab.tsx (Phase 28).
--
-- The phone itself is deleted from `phones` when this happens, the same
-- as the existing Delete action, so its buy cost drops back out of Total
-- Cash/Total Buy automatically (lib/cash.ts sums buy_price straight from
-- the live `phones` table -- no separate reversal needed). But unlike a
-- plain delete, a snapshot of the phone is kept here first, so the shop
-- owner can still see later what was returned, to whom, and when --
-- see GET /api/phone-returns and the "Return History" popup in Stock.
CREATE TABLE IF NOT EXISTS phone_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  imei TEXT NOT NULL,
  name_model TEXT NOT NULL,
  buy_price REAL NOT NULL,
  buy_date TEXT,
  ram_rom TEXT,
  battery_health TEXT,
  bought_from TEXT,
  phone_number TEXT,
  nid TEXT,
  seller_type TEXT,
  returned_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  returned_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_phone_returns_returned_at ON phone_returns(returned_at);
