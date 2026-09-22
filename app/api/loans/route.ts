import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Loans — now a per-person running ledger. GET returns one row per
// (direction, person) account with its totals; the full entry-by-entry
// history lives behind GET /api/loans/[id].
//
// Loan cash flow now feeds into /api/dashboard's Total Cash (see that
// route) — it's no longer excluded.
export async function GET() {
  const db = getDB();
  const { results } = await db
    .prepare(
      `SELECT
         la.id, la.direction, la.person_name, la.created_at,
         COALESCE(SUM(CASE WHEN le.kind = 'disburse' THEN le.amount ELSE 0 END), 0) AS disbursed,
         COALESCE(SUM(CASE WHEN le.kind = 'repay' THEN le.amount ELSE 0 END), 0) AS repaid,
         MAX(le.entry_date) AS last_entry_date
       FROM loan_accounts la
       LEFT JOIN loan_entries le ON le.account_id = la.id
       GROUP BY la.id
       ORDER BY
         (COALESCE(SUM(CASE WHEN le.kind = 'disburse' THEN le.amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN le.kind = 'repay' THEN le.amount ELSE 0 END), 0)) <= 0,
         MAX(le.entry_date) DESC`
    )
    .all();

  const accounts = (results as any[]).map((r) => ({
    ...r,
    remaining: Number(r.disbursed) - Number(r.repaid),
  }));

  return NextResponse.json({ accounts });
}

// Record a new "disburse" (taking or giving a loan). If an account already
// exists for this exact direction + person (matched case-insensitively, so
// "Rahim" and "rahim" merge), the amount adds into it as a new entry
// instead of creating a separate line.
export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const { direction, person_name, amount, loan_date } = body;

  if (direction !== "taken" && direction !== "given") {
    return NextResponse.json({ error: "Select a valid type" }, { status: 400 });
  }
  const name = String(person_name || "").trim();
  if (!name || amount === undefined || Number(amount) <= 0) {
    return NextResponse.json({ error: "Fill in all fields" }, { status: 400 });
  }

  const existing = await db
    .prepare(
      `SELECT id FROM loan_accounts WHERE direction = ? AND LOWER(TRIM(person_name)) = LOWER(?)`
    )
    .bind(direction, name)
    .first<{ id: number }>();

  let accountId: number;
  if (existing) {
    accountId = existing.id;
  } else {
    const created = await db
      .prepare(`INSERT INTO loan_accounts (direction, person_name) VALUES (?, ?)`)
      .bind(direction, name)
      .run();
    accountId = created.meta.last_row_id as number;
  }

  await db
    .prepare(
      `INSERT INTO loan_entries (account_id, kind, amount, entry_date)
       VALUES (?, 'disburse', ?, COALESCE(?, datetime('now','localtime')))`
    )
    .bind(accountId, Number(amount), loan_date || null)
    .run();

  return NextResponse.json({ id: accountId }, { status: 201 });
}
