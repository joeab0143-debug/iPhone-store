import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// Rejects a queued POS Manager request -- nothing is applied, the original
// record (if any) stays exactly as it was. Admin-only.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const row = await db
    .prepare("SELECT status FROM pending_approvals WHERE id = ?")
    .bind(params.id)
    .first<{ status: string }>();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== "pending") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  await db
    .prepare(
      `UPDATE pending_approvals SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?`
    )
    .bind(user.username, params.id)
    .run();

  return NextResponse.json({ ok: true });
}
