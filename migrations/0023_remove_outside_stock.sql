-- Removes the "Outside Stock" feature entirely (per owner's request -- the
-- 50%-profit-split calculation isn't needed in this software anymore).
--
-- This purges all historical Outside Stock data: every phone bought as
-- "outside" stock_type and its sale (if sold), so they no longer count
-- toward Total Cash or Net Profit at all -- per the owner's explicit
-- choice to delete the old data too, not just hide the feature.
--
-- The `phones.stock_type` column itself (added by
-- migrations/0017_outside_stock.sql) is left in place rather than dropped
-- -- it is harmless going forward, since the app no longer ever writes
-- 'outside' into it (every new row defaults to 'regular'), and dropping a
-- column is a riskier schema change than simply no longer using it.
DELETE FROM sales WHERE phone_id IN (SELECT id FROM phones WHERE stock_type = 'outside');
DELETE FROM phones WHERE stock_type = 'outside';
