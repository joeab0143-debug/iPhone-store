-- Configurable notice/warning message lines printed below the PAID/DUE
-- stamp on the Sales Invoice memo (see lib/sales-invoice.ts). Stored as a
-- JSON-encoded array of strings so Settings -> Shop / Invoice Info can add
-- or remove lines freely without a schema change.
ALTER TABLE shop_info ADD COLUMN notice_lines TEXT;

UPDATE shop_info
SET notice_lines = '["Sold products cannot be returned or exchanged without prior approval.","Please keep this invoice safe for any warranty or after-sales service."]'
WHERE id = 1 AND notice_lines IS NULL;
