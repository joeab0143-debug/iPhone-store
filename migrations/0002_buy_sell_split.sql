-- Phone Fantasy — split "Outside Profit" into a Buy stage (purchase from an
-- individual) and an Outside Sell stage, so it mirrors the main Stock -> Sell
-- flow instead of one combined form.

ALTER TABLE outside_deals ADD COLUMN ram_rom TEXT;
ALTER TABLE outside_deals ADD COLUMN bought_from TEXT;
ALTER TABLE outside_deals ADD COLUMN status TEXT NOT NULL DEFAULT 'sold'; -- unsold | sold
ALTER TABLE outside_deals ADD COLUMN customer_name TEXT;
ALTER TABLE outside_deals ADD COLUMN customer_phone TEXT;
ALTER TABLE outside_deals ADD COLUMN sell_date TEXT;

-- Existing rows were created through the old combined buy+sell form, so they
-- default to 'sold' above (they already have their sell details, if any).
-- New rows created through the Buy tab are inserted with status='unsold'.

CREATE INDEX IF NOT EXISTS idx_outside_status ON outside_deals(status);
CREATE INDEX IF NOT EXISTS idx_outside_imei ON outside_deals(imei);
CREATE INDEX IF NOT EXISTS idx_phones_imei ON phones(imei);
