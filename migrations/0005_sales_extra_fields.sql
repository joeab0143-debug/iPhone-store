-- iPhone Store — Sell form gains two optional fields (RAM/ROM, Battery
-- Health) captured at sale time. Both are nullable so the existing Sell
-- flow keeps working when left blank; the receipt only prints a line for
-- whichever ones were actually filled in.

ALTER TABLE sales ADD COLUMN ram_rom TEXT;
ALTER TABLE sales ADD COLUMN battery_health TEXT;
