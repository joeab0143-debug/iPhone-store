-- Second manual Total Cash correction — same mechanism as migration 0013
-- (cash_adjustments.amount is a running offset added into the Total Cash
-- formula, nothing else touched). Total Cash had since moved to ৳29,100
-- through normal sell/buy/expense activity and needs to become ৳61,100:
-- 61100 - 29100 = 32000, added on top of whatever the offset already was.
UPDATE cash_adjustments SET amount = amount + 32000, updated_at = datetime('now','localtime') WHERE id = 1;
