import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Top-of-app dashboard stats. Always computed fresh from the tables (no
// cache), so it's real-time by construction — every load reflects whatever
// has been sold/bought/spent up to that moment.
//
// Buy always writes into `phones` now (Stock tab shows everything bought),
// so total_buy / stock_count come from `phones` alone. Outside Sell is a
// standalone profit log (no buy cost, no stock impact) — its profit adds
// straight into cash and total profit.
export async function GET() {
  const db = getDB();

  const [
    totalBuy,
    stockCount,
    salesToday,
    salesPaid,
    salesProfit,
    outsideProfitToday,
    outsideProfitSold,
    expenseTotal,
  ] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(buy_price),0) AS total FROM phones").first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) AS cnt FROM phones WHERE status = 'unsold'").first<{ cnt: number }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(selling_price),0) AS total FROM sales WHERE date(selling_date) = date('now','localtime')"
      )
      .first<{ total: number }>(),
    db.prepare("SELECT COALESCE(SUM(paid_amount),0) AS total FROM sales").first<{ total: number }>(),
    db.prepare("SELECT COALESCE(SUM(profit),0) AS total FROM sales").first<{ total: number }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(profit),0) AS total FROM outside_deals WHERE status = 'sold' AND date(sell_date) = date('now','localtime')"
      )
      .first<{ total: number }>(),
    db
      .prepare("SELECT COALESCE(SUM(profit),0) AS total FROM outside_deals WHERE status = 'sold'")
      .first<{ total: number }>(),
    db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM expenses").first<{ total: number }>(),
  ]);

  const totalBuyAmt = totalBuy?.total ?? 0;
  const stockCountAmt = stockCount?.cnt ?? 0;
  const todaySale = (salesToday?.total ?? 0) + (outsideProfitToday?.total ?? 0);

  // Cash on hand = actual cash received (sales' paid_amount + Outside Sell
  // profit, since Outside Sell has no tracked buy cost) minus everything
  // spent buying stock and paying expenses.
  const cashIn = (salesPaid?.total ?? 0) + (outsideProfitSold?.total ?? 0);
  const cashOut = totalBuyAmt + (expenseTotal?.total ?? 0);
  const totalCash = cashIn - cashOut;

  const profitTillNow =
    (salesProfit?.total ?? 0) + (outsideProfitSold?.total ?? 0) - (expenseTotal?.total ?? 0);

  return NextResponse.json({
    total_cash: totalCash,
    today_sale: todaySale,
    total_buy: totalBuyAmt,
    stock_count: stockCountAmt,
    profit_till_now: profitTillNow,
  });
}
