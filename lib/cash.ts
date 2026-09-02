import { getDB } from "@/lib/db";

// Shared by /api/dashboard and /api/cash-adjustment so both always agree on
// what "Total Cash" is built from. Everything here is all-time and never
// resets (unlike "প্রফিট এ পর্যন্ত", which is month-scoped).
//
// Total Cash = cashIn - cashOut + the manual adjustment (see
// getCashAdjustment/setCashAdjustment below and migrations/0013+).
export async function computeCashParts(): Promise<{
  cashIn: number;
  cashOut: number;
  totalBuyAmt: number;
}> {
  const db = getDB();
  const [salesPaidAllTime, outsideProfitAllTime, totalBuy, expenseAllTime, loanFlow] =
    await Promise.all([
      db.prepare("SELECT COALESCE(SUM(paid_amount),0) AS total FROM sales").first<{ total: number }>(),
      db
        .prepare("SELECT COALESCE(SUM(profit),0) AS total FROM outside_deals WHERE status = 'sold'")
        .first<{ total: number }>(),
      db.prepare("SELECT COALESCE(SUM(buy_price),0) AS total FROM phones").first<{ total: number }>(),
      db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM expenses").first<{ total: number }>(),
      db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN la.direction='taken' AND le.kind='disburse' THEN le.amount ELSE 0 END),0) AS taken_in,
             COALESCE(SUM(CASE WHEN la.direction='given' AND le.kind='repay' THEN le.amount ELSE 0 END),0) AS given_repaid_in,
             COALESCE(SUM(CASE WHEN la.direction='given' AND le.kind='disburse' THEN le.amount ELSE 0 END),0) AS given_out,
             COALESCE(SUM(CASE WHEN la.direction='taken' AND le.kind='repay' THEN le.amount ELSE 0 END),0) AS taken_repaid_out
           FROM loan_entries le JOIN loan_accounts la ON la.id = le.account_id`
        )
        .first<{
          taken_in: number;
          given_repaid_in: number;
          given_out: number;
          taken_repaid_out: number;
        }>(),
    ]);

  const loanCashIn = (loanFlow?.taken_in ?? 0) + (loanFlow?.given_repaid_in ?? 0);
  const loanCashOut = (loanFlow?.given_out ?? 0) + (loanFlow?.taken_repaid_out ?? 0);
  const totalBuyAmt = totalBuy?.total ?? 0;
  const cashIn = (salesPaidAllTime?.total ?? 0) + (outsideProfitAllTime?.total ?? 0) + loanCashIn;
  const cashOut = totalBuyAmt + (expenseAllTime?.total ?? 0) + loanCashOut;

  return { cashIn, cashOut, totalBuyAmt };
}

// The manual correction (see migrations/0013 onward) — 0 unless someone's
// explicitly fixed the starting cash balance from Settings. Table may not
// exist on an older DB that hasn't run that migration yet, hence the catch.
export async function getCashAdjustment(): Promise<number> {
  const db = getDB();
  const row = await db
    .prepare("SELECT amount FROM cash_adjustments WHERE id = 1")
    .first<{ amount: number }>()
    .catch(() => null);
  return row?.amount ?? 0;
}

export async function setCashAdjustment(amount: number): Promise<void> {
  const db = getDB();
  await db
    .prepare(
      `INSERT INTO cash_adjustments (id, amount, updated_at) VALUES (1, ?, datetime('now','localtime'))
       ON CONFLICT (id) DO UPDATE SET amount = excluded.amount, updated_at = datetime('now','localtime')`
    )
    .bind(amount)
    .run();
}
