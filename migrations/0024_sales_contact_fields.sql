-- The printed Sales Invoice memo has always had a place for the customer's
-- Address, Email, and a Narration/note line (see lib/sales-invoice.ts), but
-- the Sell form never asked for them -- so they always printed as "-".
-- This adds the three columns needed to actually collect and store them.
-- All three are optional/nullable: leaving them blank on the Sell form
-- still works exactly as before, they just print as "-" like today.
ALTER TABLE sales ADD COLUMN customer_address TEXT;
ALTER TABLE sales ADD COLUMN customer_email TEXT;
ALTER TABLE sales ADD COLUMN narration TEXT;
