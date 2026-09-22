import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// The breakdown shown when the "This Month's Profit" dashboard tile is
// clicked — which categories (stock profit, used phone profit, Outside
// profit, each expense category) add up or subtract to make this month's
// profit. Scoped to just the current calendar month — uses the same
// month-scope as /api/dashboard's profit_till_now (strftime('%Y-%m', ...) =
// current month), so the two numbers always match. Multiple expense
// categories with the same name are GROUP BY'd together and shown as one
// line.
//
// "Used Phone" (migrations/0017) excludes stock_profit from that phone's
// sale — instead, 50% of that sale's full profit is added separately into
// outside_stock_profit (the other 50% belongs to the phone's actual owner,
// not tracked in this app).
export async function GET() {
  const db = getDB();

  const [stockProfitRow, outsideProfitRow, outsideStockProfitRow, expenseRows] = await Promise.all([
    db
      .prepare(
        `SELECT COALESCE(SUM(s.profit),0) AS total FROM sales s JOIN phones p ON p.id = s.phone_id
         WHERE strftime('%Y-%m', s.selling_date) = strftime('%Y-%m','now','localtime') AND p.stock_type != 'outside'`
      )
      .first<{ total: number }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(profit),0) AS total FROM outside_deals WHERE status = 'sold' AND strftime('%Y-%m', sell_date) = strftime('%Y-%m','now','localtime')"
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
        `SELECT c.name AS category_name, COALESCE(SUM(e.amount),0) AS total
         FROM expenses e
         JOIN expense_categories c ON c.id = e.category_id
         WHERE strftime('%Y-%m', e.expense_date) = strftime('%Y-%m','now','localtime')
         GROUP BY c.name
         ORDER BY total DESC`
      )
      .all<{ category_name: string; total: number }>(),
  ]);

  const stockProfit = stockProfitRow?.total ?? 0;
  const outsideProfit = outsideProfitRow?.total ?? 0;
  const outsideStockProfit = (outsideStockProfitRow?.total ?? 0) * 0.5;
  const expenseCategories = (expenseRows?.results ?? []).map((r) => ({
    name: r.category_name,
    total: r.total,
  }));
  const totalExpense = expenseCategories.reduce((s, c) => s + c.total, 0);
  const netProfit = stockProfit + outsideProfit + outsideStockProfit - totalExpense;

  return NextResponse.json({
    stock_profit: stockProfit,
    outside_profit: outsideProfit,
    outside_stock_profit: outsideStockProfit,
    expense_categories: expenseCategories,
    total_expense: totalExpense,
    net_profit: netProfit,
  });
}
