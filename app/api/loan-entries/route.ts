import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// All loan_entries across every account, each row carrying its account's
// person_name/direction — used by the Total Cash breakdown's drill-down
// ("ধার থেকে পাওয়া টাকা" → which entries made up that cash-in). Kept as a
// plain row list (not pre-classified into in/out) so the client can filter
// however a given breakdown needs; the in/out classification itself mirrors
// lib/cash.ts's computeCashParts exactly.
export async function GET() {
  const db = getDB();
  const { results } = await db
    .prepare(
      `SELECT le.id, le.account_id, le.kind, le.amount, le.entry_date, la.person_name, la.direction
       FROM loan_entries le
       JOIN loan_accounts la ON la.id = le.account_id
       ORDER BY le.entry_date DESC`
    )
    .all();
  return NextResponse.json({ entries: results });
}
