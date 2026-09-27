-- Variant (e.g. "Pro Max", storage size) and Color of a purchased phone --
-- two free-text fields added to the Buy sheet (and editable later from
-- Stock's Edit sheet), shown on the print label directly above the
-- barcode, and on the sales invoice/memo at sell time. NULL for phones
-- bought before these fields existed.
ALTER TABLE phones ADD COLUMN variant TEXT;
ALTER TABLE phones ADD COLUMN color TEXT;
