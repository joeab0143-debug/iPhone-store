import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Top-of-app dashboard stats. Always computed fresh from the tables (no
// cache), so it's real-time by construction — every load reflects whatever
// has been sold/bought/spent up to that moment.
export async function GET() {
  const db = getDB();

  const [
    phonesBuy,
    outsideBuy,
    phonesStock,
    outsideStock,
    salesToday,
    outsideToday,
    salesPaid,
    outsideSoldSum,
    salesProfit,
    outsideProfitSold,
    expenseTotal,
  ] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(buy_price),0) AS total FROM phones").first<{ total: number }>(),
    db.prepare("SELECT COALESCE(SUM(buy_price),0) AS total FROM outside_deals").first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) AS cnt FROM phones WHERE status = 'unsold'").first<{ cnt: number }>(),
    db.prepare("SELECT COUNT(*) AS cnt FROM outside_deals WHERE status = 'unsold'").first<{ cnt: number }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(selling_price),0) AS total FROM sales WHERE date(selling_date) = date('now','localtime')"
      )
      .first<{ total: number }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(sell_price),0) AS total FROM outside_deals WHERE status = 'sold' AND date(sell_date) = date('now','localtime')"
      )
      .first<{ total: number }>(),
    db.prepare("SELECT COALESCE(SUM(paid_amount),0) AS total FROM sales").first<{ total: number }>(),
    db
      .prepare("SELECT COALESCE(SUM(sell_price),0) AS total FROM outside_deals WHERE status = 'sold'")
      .first<{ total: number }>(),
    db.prepare("SELECT COALESCE(SUM(profit),0) AS total FROM sales").first<{ total: number }>(),
    db
      .prepare("SELECT COALESCE(SUM(profit),0) AS total FROM outside_deals WHERE status = 'sold'")
      .first<{ total: number }>(),
    db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM expenses").first<{ total: number }>(),
  ]);

  const totalBuy = (phonesBuy?.total ?? 0) + (outsideBuy?.total ?? 0);
  const stockCount = (phonesStock?.cnt ?? 0) + (outsideStock?.cnt ?? 0);
  const todaySale = (salesToday?.total ?? 0) + (outsideToday?.total ?? 0);

  // Cash on hand = actual cash received (paid_amount respects due sales) minus
  // everything spent buying stock and paying expenses.
  const cashIn = (salesPaid?.total ?? 0) + (outsideSoldSum?.total ?? 0);
  const cashOut = totalBuy + (expenseTotal?.total ?? 0);
  const totalCash = cashIn - cashOut;

  const profitTillNow =
    (salesProfit?.total ?? 0) + (outsideProfitSold?.total ?? 0) - (expenseTotal?.total ?? 0);

  return NextResponse.json({
    total_cash: totalCash,
    today_sale: todaySale,
    total_buy: totalBuy,
    stock_count: stockCount,
    profit_till_now: profitTillNow,
  });
}
