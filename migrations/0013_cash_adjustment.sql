-- One-time correction to Total Cash, without touching stock/sales/expense
-- data at all. The shop's real cash-on-hand didn't match what the app
-- computed (app tracking started after the shop already had money/stock
-- history outside it) — this table holds a single manual offset that gets
-- added into the Total Cash formula in /api/dashboard, so every future
-- sell/buy/expense/loan still adds/subtracts normally on top of this
-- corrected baseline.
CREATE TABLE IF NOT EXISTS cash_adjustments (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  amount REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

INSERT INTO cash_adjustments (id, amount) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- The correction itself: Total Cash was ৳-328,650, needs to become ৳61,100.
-- 61100 - (-328650) = 389750.
UPDATE cash_adjustments SET amount = 389750, updated_at = datetime('now','localtime') WHERE id = 1;
