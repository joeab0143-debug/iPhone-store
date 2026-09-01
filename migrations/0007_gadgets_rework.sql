-- Phone Fantasy — rework Gadgets & Accessories.
--
-- Old model: one row per item, with buy_price AND sell_price entered
-- together at the same time (as if every item was already sold).
--
-- New model: enter Buy Name + Buy Price + Quantity when items come in;
-- each unit is then sold separately, whenever it actually sells, via its
-- own "Sell" action with its own sell price. gadgets.quantity is the total
-- number of units originally bought (never edited afterwards); how many are
-- still in hand is computed as quantity minus how many rows exist for that
-- gadget in gadget_sales.
--
-- NOTE: this replaces the "gadgets" table from migration 0004 rather than
-- extending it (its shape has no room for quantity/per-unit sales). If real
-- Gadgets entries were already saved in production before this migration
-- runs, tell the developer first — running this drops that table.

DROP TABLE IF EXISTS gadget_sales;
DROP TABLE IF EXISTS gadgets;

CREATE TABLE gadgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  buy_name TEXT NOT NULL,
  buy_price REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE gadget_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gadget_id INTEGER NOT NULL REFERENCES gadgets(id),
  sell_price REAL NOT NULL,
  profit REAL NOT NULL,
  sold_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_gadgets_date ON gadgets(created_at);
CREATE INDEX IF NOT EXISTS idx_gadget_sales_gadget ON gadget_sales(gadget_id);
CREATE INDEX IF NOT EXISTS idx_gadget_sales_date ON gadget_sales(sold_at);
