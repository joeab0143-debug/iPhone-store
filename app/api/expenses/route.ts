import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const db = getDB();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  let query = `
    SELECT e.*, c.name AS category_name
    FROM expenses e
    JOIN expense_categories c ON c.id = e.category_id
    WHERE 1=1
  `;
  const binds: string[] = [];
  if (from) {
    query += " AND date(e.expense_date) >= date(?)";
    binds.push(from);
  }
  if (to) {
    query += " AND date(e.expense_date) <= date(?)";
    binds.push(to);
  }
  query += " ORDER BY e.expense_date DESC";

  const { results } = await db.prepare(query).bind(...binds).all();
  return NextResponse.json({ expenses: results });
}

export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const { category_id, amount, expense_date, note } = body;

  if (!category_id || amount === undefined) {
    return NextResponse.json({ error: "Category and amount are required" }, { status: 400 });
  }

  const result = await db
    .prepare(
      `INSERT INTO expenses (category_id, amount, expense_date, note)
       VALUES (?, ?, COALESCE(?, datetime('now','localtime')), ?)`
    )
    .bind(category_id, amount, expense_date || null, note || null)
    .run();

  return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}
