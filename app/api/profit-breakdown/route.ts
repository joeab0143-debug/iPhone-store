import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// The breakdown shown when the "This Month's Profit" dashboard tile is
// clicked — which categories (stock profit, each expense category) add up
// or subtract to make this month's profit. Scoped to just the current
// calendar month — uses the same month-scope as /api/dashboard's
// profit_till_now (strftime('%Y-%m', ...) = current month), so the two
// numbers always match. Multiple expense categories with the same name are
// GROUP BY'd together and shown as one line.
export async function GET() {
  const db = getDB();

  const [stockProfitRow, expenseRows] = await Promise.all([
    db
      .prepare(
        `SELECT COALESCE(SUM(profit),0) AS total FROM sales
         WHERE strftime('%Y-%m', selling_date) = strftime('%Y-%m','now','localtime')`
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
  const expenseCategories = (expenseRows?.results ?? []).map((r) => ({
    name: r.category_name,
    total: r.total,
  }));
  const totalExpense = expenseCategories.reduce((s, c) => s + c.total, 0);
  const netProfit = stockProfit - totalExpense;

  return NextResponse.json({
    stock_profit: stockProfit,
    expense_categories: expenseCategories,
    total_expense: totalExpense,
    net_profit: netProfit,
  });
}
