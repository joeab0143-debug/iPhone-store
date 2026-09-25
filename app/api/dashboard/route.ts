import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { computeCashParts, getCashAdjustment } from "@/lib/cash";

export const runtime = "edge";

// Top-of-app dashboard stats. Always computed fresh from the tables (no
// cache), so it's real-time by construction — every load reflects whatever
// has been sold/bought/spent up to that moment.
//
// Buy always writes into `phones` now (Stock tab shows everything bought),
// so total_buy / stock_count come from `phones` alone. "Outside Stock"
// (migrations/0017) is a real phones-table row, Buy just skips the cash
// deduction for it, and only 50% of its sale profit counts toward profit.
//
// Total Cash and Stock never reset — they always come from the all-time
// totals, carrying over from one month to the next. But "Profit (So
// Far)" restarts at 0 at the beginning of every calendar month — it's
// just this month's sale profit + Outside Stock profit (50%) minus this
// month's expenses. Older months' figures aren't lost — they can still be
// viewed via the Expense/Profit tab's month picker.
//
// Total Cash's own formula (cashIn/cashOut/the manual adjustment) lives in
// lib/cash.ts, shared with /api/cash-adjustment (Settings → "Fix Total
// Cash") so both always agree on the same numbers.
export async function GET() {
  const db = getDB();

  const [
    stockCount,
    salesToday,
    salesProfitThisMonth,
    outsideStockProfitThisMonth,
    expenseThisMonth,
    { cashIn, cashOut, totalBuyAmt },
    cashAdjustmentAmt,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS cnt FROM phones WHERE status = 'unsold'").first<{ cnt: number }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(selling_price),0) AS total FROM sales WHERE date(selling_date) = date('now','localtime')"
      )
      .first<{ total: number }>(),
    // "Outside Stock" sales are excluded here — only 50% of their profit
    // counts toward this month's profit (see outsideStockProfitThisMonth).
    db
      .prepare(
        `SELECT COALESCE(SUM(s.profit),0) AS total FROM sales s JOIN phones p ON p.id = s.phone_id
         WHERE strftime('%Y-%m', s.selling_date) = strftime('%Y-%m','now','localtime') AND p.stock_type != 'outside'`
      )
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(s.profit),0) AS total FROM sales s JOIN phones p ON p.id = s.phone_id
         WHERE strftime('%Y-%m', s.selling_date) = strftime('%Y-%m','now','localtime') AND p.stock_type = 'outside'`
      )
      .first<{ total: number }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m','now','localtime')"
      )
      .first<{ total: number }>(),
    computeCashParts(),
    getCashAdjustment(),
  ]);

  const stockCountAmt = stockCount?.cnt ?? 0;
  const todaySale = salesToday?.total ?? 0;

  // Cash on hand = actual cash received (sales' paid_amount) minus
  // everything spent (buying stock, expenses), plus any manual
  // correction — all-time, never resets.
  const totalCash = cashIn - cashOut + cashAdjustmentAmt;

  // Profit (So Far) — restarts at the beginning of every calendar month.
  const profitTillNow =
    (salesProfitThisMonth?.total ?? 0) +
    (outsideStockProfitThisMonth?.total ?? 0) * 0.5 -
    (expenseThisMonth?.total ?? 0);

  return NextResponse.json({
    total_cash: totalCash,
    today_sale: todaySale,
    total_buy: totalBuyAmt,
    stock_count: stockCountAmt,
    profit_till_now: profitTillNow,
  });
}
