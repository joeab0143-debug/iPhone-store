import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { computeCashParts, getCashAdjustment } from "@/lib/cash";

export const runtime = "edge";

// Read-only, all-time breakdown of exactly what makes up "Total Cash" —
// backs the clickable detail view under that dashboard tile. Uses the same
// computeCashParts()/getCashAdjustment() helpers as /api/dashboard and
// /api/cash-adjustment, so these numbers can never disagree with the
// headline figure.
export async function GET() {
  const db = getDB();
  const [{ cashIn, cashOut, totalBuyAmt }, adjustment, salesPaidRow, expenseRow] =
    await Promise.all([
      computeCashParts(),
      getCashAdjustment(),
      db.prepare("SELECT COALESCE(SUM(paid_amount),0) AS total FROM sales").first<{ total: number }>(),
      db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM expenses").first<{ total: number }>(),
    ]);

  const totalCash = cashIn - cashOut + adjustment;

  return NextResponse.json({
    total_cash: totalCash,
    sales_paid: salesPaidRow?.total ?? 0,
    total_buy: totalBuyAmt,
    expenses: expenseRow?.total ?? 0,
    adjustment,
  });
}
