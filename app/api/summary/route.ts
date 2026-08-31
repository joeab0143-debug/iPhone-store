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
      `SELECT COALESCE(SUM(profit),0) AS total, COUNT(*) AS cnt FROM sales ${stockWhere.clause}`
    )
    .bind(...stockWhere.binds)
    .first<{ total: number; cnt: number }>();

  // Outside profit is realized at sell time (the Outside Sell sheet), not at
  // purchase time, and only sold rows have a profit — so filter on sell_date
  // and require status='sold' rather than filtering on the buy date.
  const outsideWhere = dateWhere("sell_date");
  const outsideBaseClause = outsideWhere.clause
    ? outsideWhere.clause + " AND status = 'sold'"
    : "WHERE status = 'sold'";
  const outsideRow = await db
    .prepare(
      `SELECT COALESCE(SUM(profit),0) AS total, COUNT(*) AS cnt FROM outside_deals ${outsideBaseClause}`
    )
    .bind(...outsideWhere.binds)
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
  const outsideProfit = outsideRow?.total ?? 0;
  const totalExpense = expenseRow?.total ?? 0;
  const netProfit = stockProfit + outsideProfit - totalExpense;

  return NextResponse.json({
    from: from || null,
    to: to || null,
    stock_profit: stockProfit,
    outside_profit: outsideProfit,
    total_expense: totalExpense,
    total_due_outstanding: dueRow?.total ?? 0,
    net_profit: netProfit,
    stock_sales_count: stockRow?.cnt ?? 0,
    outside_deals_count: outsideRow?.cnt ?? 0,
  });
}
