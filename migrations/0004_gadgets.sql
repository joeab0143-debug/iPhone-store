-- Phone Fantasy — Gadgets & Accessories: a standalone buy/sell log, separate
-- from the main phone business. Its profit is intentionally NOT included in
-- any dashboard stat or the Profit tab's net profit — it only shows inside
-- the Gadgets & Accessories tab itself, for the user to check when needed.

CREATE TABLE IF NOT EXISTS gadgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buy_name TEXT NOT NULL,
  buy_price REAL NOT NULL DEFAULT 0,
  sell_price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_gadgets_date ON gadgets(created_at);
