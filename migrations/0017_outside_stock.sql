-- Phone Fantasy — "Outside Stock" phones: bought without touching Total
-- Cash (the shop is just holding/reselling them on someone else's behalf),
-- and only 50% of their eventual sale profit counts toward the shop's own
-- Profit. Regular Buy keeps working exactly as before — every existing row
-- and every new row defaults to 'regular' unless the Buy form explicitly
-- marks it 'outside'.
ALTER TABLE phones ADD COLUMN stock_type TEXT NOT NULL DEFAULT 'regular';
