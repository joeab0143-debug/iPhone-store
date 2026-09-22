-- Shop identity shown on the printed Sales Invoice memo (see
-- lib/sales-invoice.ts). Singleton row, same pattern as app_credentials --
-- editable from Settings -> Shop / Invoice Info (admin only).
CREATE TABLE IF NOT EXISTS shop_info (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  shop_name TEXT NOT NULL DEFAULT 'iPhone Store',
  address TEXT,
  phone TEXT,
  email TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

INSERT INTO shop_info (id, shop_name, address, phone, email)
VALUES (1, 'iPhone Store', NULL, '01708115797', NULL)
ON CONFLICT (id) DO NOTHING;
