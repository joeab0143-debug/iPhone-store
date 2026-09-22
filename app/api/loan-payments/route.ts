import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Record a repayment (partial or full) against a loan account — either
// direction (taken: paying someone back; given: getting paid back).
export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const { account_id, amount, note, paid_date } = body;

  if (!account_id || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  const agg = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'disburse' THEN amount ELSE 0 END), 0) AS disbursed,
         COALESCE(SUM(CASE WHEN kind = 'repay' THEN amount ELSE 0 END), 0) AS repaid
       FROM loan_entries WHERE account_id = ?`
    )
    .bind(account_id)
    .first<{ disbursed: number; repaid: number }>();

  if (!agg || Number(agg.disbursed) === 0) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const remaining = Number(agg.disbursed) - Number(agg.repaid);
  if (Number(amount) > remaining) {
    return NextResponse.json(
      { error: "Cannot pay more than the outstanding amount" },
      { status: 400 }
    );
  }

  await db
    .prepare(
      `INSERT INTO loan_entries (account_id, kind, amount, entry_date, note)
       VALUES (?, 'repay', ?, COALESCE(?, datetime('now','localtime')), ?)`
    )
    .bind(account_id, Number(amount), paid_date || null, note || null)
    .run();

  const newRepaid = Number(agg.repaid) + Number(amount);
  return NextResponse.json({
    ok: true,
    repaid: newRepaid,
    remaining: Number(agg.disbursed) - newRepaid,
  });
}
