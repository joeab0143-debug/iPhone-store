-- iPhone Store — full reset of all business/transactional data, per the
-- shop owner's explicit request ("সব কিছু জিরো করে দাও" -- "zero
-- everything out"), confirmed to mean: every phone, sale, expense, gadget,
-- supplier and pending-approval record is deleted, and the manual Total
-- Cash correction is reset to 0 -- so every dashboard number (Total Cash,
-- Stock, This Month's Profit, Net Profit, Due Outstanding, etc.) reads
-- zero/empty right after this runs.
--
-- Deliberately NOT touched (confirmed with the owner to keep these
-- intact):
--   * app_credentials / pos_manager_credentials / app_sessions -- admin and
--     POS Manager logins keep working exactly as before; nobody needs to
--     be re-created or re-logged-in.
--   * shop_info -- Shop Name/Address/Phone/Email/Notice lines stay as
--     already configured in Settings.
--   * expense_categories -- the category list itself (e.g. "Rent",
--     "Utility") is kept so new expenses can still be logged against them;
--     only the actual recorded `expenses` rows are wiped.
--
-- Deletes are ordered child-before-parent (matching each table's foreign
-- key) so this is safe regardless of whether SQLite foreign-key
-- enforcement happens to be on for this connection.
DELETE FROM due_payments;
DELETE FROM sales;
DELETE FROM phones;
DELETE FROM gadget_sales;
DELETE FROM gadgets;
DELETE FROM expenses;
DELETE FROM suppliers;
DELETE FROM pending_approvals;

-- Reset the AUTOINCREMENT counters too, so the next phone/sale/gadget/etc.
-- entered after this reset starts back at id = 1 instead of continuing
-- from wherever the old (now-deleted) history left off.
DELETE FROM sqlite_sequence
WHERE name IN (
  'phones', 'sales', 'due_payments', 'gadgets', 'gadget_sales',
  'expenses', 'suppliers', 'pending_approvals'
);

-- The manual "Fix Total Cash" baseline correction (see
-- migrations/0013_cash_adjustment.sql) is reset to 0 as well -- otherwise
-- Total Cash would still show that old correction amount even with every
-- other business table now empty.
UPDATE cash_adjustments SET amount = 0, updated_at = datetime('now', 'localtime') WHERE id = 1;
