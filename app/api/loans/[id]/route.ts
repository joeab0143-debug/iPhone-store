import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Mark a loan settled — "Repay" for a loan taken, "received back" for a
// loan given. Both just flip the same status/settled_date.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  await db
    .prepare(
      `UPDATE loans SET status = 'settled', settled_date = datetime('now','localtime') WHERE id = ?`
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
