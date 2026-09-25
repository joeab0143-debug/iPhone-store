import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const db = getDB();
  const from = req.nextUrl.searchParams.get("from"); // YYYY-MM-DD
  const to = req.nextUrl.searchParams.get("to"); // YYYY-MM-DD

  const dateWhere = (col: string) => {
    const parts: string[] = [];
    const binds: string[] = [];
    if (from) {
      parts.push(`date(${col}) >= date(?)`);
      binds.push(from);
    }
    if (to) {
      parts.push(`date(${col}) <= date(?)`);
      binds.push(to);
    }
    return { clause: parts.length ? "WHERE " + parts.join(" AND ") : "", binds };
  };

  const stockWhere = dateWhere("selling_date");
  const stockRow = await db
    .prepare(
      `SELECT COALESCE(SUM(profit),0) AS total, COUNT(*) AS cnt
       FROM sales ${stockWhere.clause}`
    )
    .bind(...stockWhere.binds)
    .first<{ total: number; cnt: number }>();

  const expenseWhere = dateWhere("expense_date");
  const expenseRow = await db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) AS total FROM expenses ${expenseWhere.clause}`
    )
    .bind(...expenseWhere.binds)
    .first<{ total: number }>();

  const dueRow = await db
    .prepare(`SELECT COALESCE(SUM(due_amount),0) AS total FROM sales WHERE due_amount > 0`)
    .first<{ total: number }>();

  const stockProfit = stockRow?.total ?? 0;
  const totalExpense = expenseRow?.total ?? 0;
  const netProfit = stockProfit - totalExpense;

  return NextResponse.json({
    from: from || null,
    to: to || null,
    stock_profit: stockProfit,
    total_expense: totalExpense,
    total_due_outstanding: dueRow?.total ?? 0,
    net_profit: netProfit,
    stock_sales_count: stockRow?.cnt ?? 0,
  });
}
