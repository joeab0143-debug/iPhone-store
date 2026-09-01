import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Loans — a private personal ledger, kept deliberately separate from the
// shop's own cash flow. Never summed into /api/dashboard or the Profit tab.
export async function GET() {
  const db = getDB();
  const { results } = await db
    .prepare("SELECT * FROM loans ORDER BY (status = 'pending') DESC, loan_date DESC")
    .all();
  return NextResponse.json({ loans: results });
}

export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const { direction, person_name, amount, loan_date } = body;

  if (direction !== "taken" && direction !== "given") {
    return NextResponse.json({ error: "সঠিক ধরন দিন" }, { status: 400 });
  }
  if (!person_name || amount === undefined || Number(amount) <= 0) {
    return NextResponse.json({ error: "সব ঘর পূরণ করুন" }, { status: 400 });
  }

  const result = await db
    .prepare(
      `INSERT INTO loans (direction, person_name, amount, loan_date)
       VALUES (?, ?, ?, COALESCE(?, datetime('now','localtime')))`
    )
    .bind(direction, person_name, Number(amount), loan_date || null)
    .run();

  return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}
