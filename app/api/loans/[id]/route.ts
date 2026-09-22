import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Full detail for one loan account — its totals plus the complete
// chronological history of every amount taken/given and every repayment.
// Powers the "View Details" drill-down in the Loans tab.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();

  const account = await db
    .prepare(
      `SELECT
         la.id, la.direction, la.person_name, la.created_at,
         COALESCE(SUM(CASE WHEN le.kind = 'disburse' THEN le.amount ELSE 0 END), 0) AS disbursed,
         COALESCE(SUM(CASE WHEN le.kind = 'repay' THEN le.amount ELSE 0 END), 0) AS repaid
       FROM loan_accounts la
       LEFT JOIN loan_entries le ON le.account_id = la.id
       WHERE la.id = ?
       GROUP BY la.id`
    )
    .bind(params.id)
    .first<any>();

  if (!account) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  account.remaining = Number(account.disbursed) - Number(account.repaid);

  const { results: entries } = await db
    .prepare(
      `SELECT * FROM loan_entries WHERE account_id = ? ORDER BY entry_date ASC, id ASC`
    )
    .bind(params.id)
    .all();

  return NextResponse.json({ account, entries });
}

// Deletes the whole account and its entire history — used when a loan was
// entered by mistake, not for settling one (settling is just a repay entry
// for the full remaining amount, via /api/loan-payments).
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  await db.prepare("DELETE FROM loan_entries WHERE account_id = ?").bind(params.id).run();
  await db.prepare("DELETE FROM loan_accounts WHERE id = ?").bind(params.id).run();
  return NextResponse.json({ ok: true });
}
