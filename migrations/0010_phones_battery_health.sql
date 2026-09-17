-- iPhone Store — capture Battery Health at Buy time too (not just at Sell),
-- so it's known before the phone sells and can be printed on the barcode
-- sticker label along with RAM/ROM.
ALTER TABLE phones ADD COLUMN battery_health TEXT;
