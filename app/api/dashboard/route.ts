import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { computeCashParts, getCashAdjustment } from "@/lib/cash";

export const runtime = "edge";

// Top-of-app dashboard stats. Always computed fresh from the tables (no
// cache), so it's real-time by construction — every load reflects whatever
// has been sold/bought/spent up to that moment.
//
// Buy always writes into `phones` now (Stock tab shows everything bought),
// so total_buy / stock_count come from `phones` alone. Outside Sell is a
// standalone profit log (no buy cost, no stock impact) — its profit adds
// straight into cash and total profit.
//
// টোটাল ক্যাশ ও স্টক কখনো রিসেট হয় না — এগুলো সবসময় সর্বমোট (all-time)
// হিসাব থেকে আসে, একমাস থেকে আরেক মাসে অব্যাহত থাকে। কিন্তু "প্রফিট (এ
// পর্যন্ত)" প্রতি ক্যালেন্ডার মাসের শুরুতে ০ থেকে শুরু হয় — শুধু চলতি
// মাসের সেল-প্রফিট + Outside প্রফিট বিয়োগ চলতি মাসের খরচ। পুরনো মাসের
// হিসাব হারিয়ে যায় না, খরচ/প্রফিট ট্যাবের মাস-পিকার দিয়ে দেখা যায়।
//
// Total Cash's own formula (cashIn/cashOut/the manual adjustment) lives in
// lib/cash.ts, shared with /api/cash-adjustment (Settings → "ক্যাশ ঠিক
// করুন") so both always agree on the same numbers.
export async function GET() {
  const db = getDB();

  const [
    stockCount,
    salesToday,
    salesProfitThisMonth,
    outsideProfitToday,
    outsideProfitThisMonth,
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
    db
      .prepare(
        "SELECT COALESCE(SUM(profit),0) AS total FROM sales WHERE strftime('%Y-%m', selling_date) = strftime('%Y-%m','now','localtime')"
      )
      .first<{ total: number }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(profit),0) AS total FROM outside_deals WHERE status = 'sold' AND date(sell_date) = date('now','localtime')"
      )
      .first<{ total: number }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(profit),0) AS total FROM outside_deals WHERE status = 'sold' AND strftime('%Y-%m', sell_date) = strftime('%Y-%m','now','localtime')"
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
  const todaySale = (salesToday?.total ?? 0) + (outsideProfitToday?.total ?? 0);

  // Cash on hand = actual cash received (sales' paid_amount + Outside Sell
  // profit + loans taken + loan repayments received) minus everything
  // spent (buying stock, expenses, loans given out, loans paid back), plus
  // any manual correction — all-time, never resets.
  const totalCash = cashIn - cashOut + cashAdjustmentAmt;

  // Profit (এ পর্যন্ত) — restarts at the beginning of every calendar month.
  const profitTillNow =
    (salesProfitThisMonth?.total ?? 0) +
    (outsideProfitThisMonth?.total ?? 0) -
    (expenseThisMonth?.total ?? 0);

  return NextResponse.json({
    total_cash: totalCash,
    today_sale: todaySale,
    total_buy: totalBuyAmt,
    stock_count: stockCountAmt,
    profit_till_now: profitTillNow,
  });
}
