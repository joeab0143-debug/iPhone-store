-- Gadgets & Accessories — add customer + due (partial payment) support to
-- gadget_sales, mirroring the existing phone-sale due pattern (sales.is_due/
-- due_amount/paid_amount + due_payments). Lets a gadget be sold on partial
-- payment just like a phone, and lets its outstanding balance show up
-- alongside phone dues in the app's combined Due Outstanding figure.
ALTER TABLE gadget_sales ADD COLUMN customer_name TEXT;
ALTER TABLE gadget_sales ADD COLUMN customer_phone TEXT;
ALTER TABLE gadget_sales ADD COLUMN is_due INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gadget_sales ADD COLUMN due_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE gadget_sales ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0;

-- Backfill: every gadget_sales row that already existed before this
-- migration was, by definition, paid in full (there was no due concept
-- yet), so its paid_amount should equal what it sold for.
UPDATE gadget_sales SET paid_amount = sell_price WHERE is_due = 0;

CREATE TABLE IF NOT EXISTS gadget_due_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gadget_sale_id INTEGER NOT NULL REFERENCES gadget_sales(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  paid_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  note TEXT
);
