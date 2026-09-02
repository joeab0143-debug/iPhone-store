-- Third manual Total Cash correction — same running-offset mechanism as
-- 0013/0014. Total Cash was ৳51,100 and needs to become ৳61,100:
-- 61100 - 51100 = 10000, added on top of the existing offset.
UPDATE cash_adjustments SET amount = amount + 10000, updated_at = datetime('now','localtime') WHERE id = 1;
