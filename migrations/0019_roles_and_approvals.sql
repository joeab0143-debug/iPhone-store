-- POS Manager: an optional second, restricted staff login. Unlike
-- app_credentials (the single admin row, always present), this table may
-- have zero or one row -- the shop owner creates it from Settings only when
-- they want to hand a staff member day-to-day POS access without letting
-- them change or delete anything unsupervised.
CREATE TABLE IF NOT EXISTS pos_manager_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Sessions now remember which account logged in, so every route can tell
-- an admin session from a POS Manager session without a second lookup.
ALTER TABLE app_sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';

-- Edits, deletes, and new-stock purchases (Buy) made by a POS Manager land
-- here instead of applying immediately. The shop owner reviews each one
-- from the Approvals tab and approves or rejects it; only on approval does
-- the underlying table actually change. `payload` is the JSON body the POS
-- Manager submitted (null for a pure delete); `resource_id` is null for a
-- Buy, since nothing exists yet to point at. `resource_label` is a
-- human-readable snapshot captured at request time (e.g. "iPhone 13 -- IMEI
-- 123456789012345") so the Approvals list reads clearly without an extra
-- join back to a row that, for an edit, may have moved on by the time it's
-- reviewed.
CREATE TABLE IF NOT EXISTS pending_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action_type TEXT NOT NULL,        -- 'edit' | 'delete' | 'buy'
  resource_type TEXT NOT NULL,      -- 'phone' | 'sale' | 'loan_account' | 'expense_category' | 'expense' | 'gadget' | 'outside_deal'
  resource_id INTEGER,
  resource_label TEXT NOT NULL,
  payload TEXT,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewed_by TEXT,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);
