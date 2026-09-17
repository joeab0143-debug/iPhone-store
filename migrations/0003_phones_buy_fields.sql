-- iPhone Store — Buy tab now adds phones directly into the main stock
-- (phones table) instead of a separate outside_deals bucket, so "স্টক"
-- always reflects everything bought, regardless of source.
--
-- These columns are optional/nullable so the original simple "Add phone"
-- flow inside the Stock tab keeps working unchanged — only Buy-tab entries
-- populate them.

ALTER TABLE phones ADD COLUMN ram_rom TEXT;
ALTER TABLE phones ADD COLUMN bought_from TEXT;
ALTER TABLE phones ADD COLUMN phone_number TEXT;
ALTER TABLE phones ADD COLUMN nid TEXT;
