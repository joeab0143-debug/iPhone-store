-- Used Phone (the standalone Model/IMEI/Profit log, formerly "Outside
-- Sell") has been removed from the app entirely per the shop owner's
-- request -- its sidebar tab, sheet, and /api/outside routes are gone from
-- the code, and this drops its data too, including it from Total Cash and
-- Net Profit's all-time/monthly totals going forward.
--
-- NOTE: this is unrelated to "Outside Stock" (stock_type = 'outside' on
-- the `phones` table, migrations/0017) -- that consignment-style Buy/Sell
-- feature is untouched and keeps working exactly as before.
DROP TABLE IF EXISTS outside_deals;

-- Any not-yet-reviewed POS Manager request against the old feature can
-- never be approved now that the underlying table and code are gone.
DELETE FROM pending_approvals WHERE resource_type = 'outside_deal';
