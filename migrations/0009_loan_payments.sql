-- iPhone Store — partial loan repayments. Mirrors the existing due_payments
-- pattern used for phone-sale dues: loans.paid_amount tracks how much has
-- been repaid so far (against loans.amount, the original loan size), and
-- every individual repayment is logged in loan_payments so there's a
-- history. A loan flips to status='settled' automatically once
-- paid_amount reaches amount.

ALTER TABLE loans ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS loan_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL REFERENCES loans(id),
  amount REAL NOT NULL,
  paid_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);
