import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Mark a loan fully settled in one shot — "the whole thing is paid off",
// as opposed to /api/loan-payments which records a partial repayment.
// Sets paid_amount to the full loan amount so the numbers stay consistent.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  await db
    .prepare(
      `UPDATE loans SET paid_amount = amount, status = 'settled', settled_date = datetime('now','localtime') WHERE id = ?`
    )
    .bind(params.id)
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  await db.prepare("DELETE FROM loans WHERE id = ?").bind(params.id).run();
  return NextResponse.json({ ok: true });
}
