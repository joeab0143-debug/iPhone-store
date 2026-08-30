-- Phone Fantasy — Cloudflare D1 schema

CREATE TABLE IF NOT EXISTS phones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_model TEXT NOT NULL,
  imei TEXT NOT NULL UNIQUE,
  buy_price REAL NOT NULL,
  buy_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  status TEXT NOT NULL DEFAULT 'unsold', -- unsold | sold
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_id INTEGER NOT NULL REFERENCES phones(id) ON DELETE CASCADE,
  selling_price REAL NOT NULL,
  selling_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  profit REAL NOT NULL,
  is_due INTEGER NOT NULL DEFAULT 0, -- 0 = cash, 1 = due
  customer_name TEXT,
  customer_phone TEXT,
  due_amount REAL NOT NULL DEFAULT 0,   -- remaining due
  paid_amount REAL NOT NULL DEFAULT 0,  -- total paid so far
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS due_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  paid_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  note TEXT
);

-- Outside profit: used-phone buy/sell deals, tracked separately from main stock
CREATE TABLE IF NOT EXISTS outside_deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  model TEXT,
  imei TEXT,
  buy_price REAL NOT NULL DEFAULT 0,
  nid TEXT,
  phone_number TEXT,
  sell_price REAL,
  profit REAL NOT NULL DEFAULT 0,
  deal_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  designation TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  expense_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_sales_phone ON sales(phone_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(selling_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_outside_date ON outside_deals(deal_date);
CREATE INDEX IF NOT EXISTS idx_phones_status ON phones(status);
