-- Fourth manual Total Cash correction — same running-offset mechanism as
-- 0013/0014/0015. Add ৳20,500 on top of the current Total Cash
-- (৳44,100 → ৳64,600).
UPDATE cash_adjustments SET amount = amount + 20500, updated_at = datetime('now','localtime') WHERE id = 1;
