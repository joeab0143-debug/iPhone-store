-- Removes the "Loans" feature entirely (per owner's request -- the shop no
-- longer wants a Loans tab). This drops the current live schema for it:
-- loan_accounts + loan_entries (created by migrations/0011_loans_ledger.sql,
-- which itself superseded and dropped the older loans/loan_payments tables
-- from migrations/0008/0009 -- those are already gone).
--
-- This also purges all historical loan cash flow from Total Cash's all-time
-- totals (computeCashParts() in lib/cash.ts no longer includes loan_entries
-- at all as of this same change) -- per the owner's explicit choice to
-- remove old data too, not just hide the feature. This will reduce the
-- Total Cash figure by whatever net loan cash flow had accumulated.
DROP TABLE IF EXISTS loan_entries;
DROP TABLE IF EXISTS loan_accounts;

-- Clean up any pending POS-Manager approval requests that referenced a loan
-- account (resource_type = 'loan_account' is no longer a valid type).
DELETE FROM pending_approvals WHERE resource_type = 'loan_account';
