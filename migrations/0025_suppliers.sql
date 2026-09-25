-- Buy Phone gains a reusable Supplier list: instead of retyping a known
-- supplier's name/phone/NID on every purchase, the owner picks from
-- previously-used suppliers (autocomplete on "Buy from whom"), and once
-- picked, the Number/NID fields aren't needed again -- they're already on
-- file here. A name typed that doesn't match anyone on this list is saved
-- automatically the moment that Buy completes (see applyPhoneBuy() in
-- lib/approvalActions.ts) -- there's no separate "add supplier" step.
--
-- name is UNIQUE COLLATE NOCASE so "ABC Traders" and "abc traders" are
-- treated as the same supplier, matching the case-insensitive matching the
-- Buy sheet does client-side.
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone_number TEXT,
  nid TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
