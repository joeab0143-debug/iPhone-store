import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { computeCashParts, getCashAdjustment } from "@/lib/cash";

export const runtime = "edge";

// Read-only, all-time breakdown of exactly what makes up "টোটাল ক্যাশ" —
// backs the clickable detail view under that dashboard tile. Uses the same
// computeCashParts()/getCashAdjustment() helpers as /api/dashboard and
// /api/cash-adjustment, so these numbers can never disagree with the
// headline figure.
export async function GET() {
  const db = getDB();
  const [{ cashIn, cashOut, totalBuyAmt }, adjustment, salesPaidRow, outsideProfitRow, expenseRow, loanFlowRow] =
    await Promise.all([
      computeCashParts(),
      getCashAdjustment(),
      db.prepare("SELECT COALESCE(SUM(paid_amount),0) AS total FROM sales").first<{ total: number }>(),
      db
        .prepare("SELECT COALESCE(SUM(profit),0) AS total FROM outside_deals WHERE status = 'sold'")
        .first<{ total: number }>(),
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
        .first<{ taken_in: number; given_repaid_in: number; given_out: number; taken_repaid_out: number }>(),
    ]);

  const totalCash = cashIn - cashOut + adjustment;
  const loanCashIn = (loanFlowRow?.taken_in ?? 0) + (loanFlowRow?.given_repaid_in ?? 0);
  const loanCashOut = (loanFlowRow?.given_out ?? 0) + (loanFlowRow?.taken_repaid_out ?? 0);

  return NextResponse.json({
    total_cash: totalCash,
    sales_paid: salesPaidRow?.total ?? 0,
    outside_profit: outsideProfitRow?.total ?? 0,
    loan_cash_in: loanCashIn,
    total_buy: totalBuyAmt,
    expenses: expenseRow?.total ?? 0,
    loan_cash_out: loanCashOut,
    adjustment,
  });
}
