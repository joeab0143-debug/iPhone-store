import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { applyPendingApproval } from "@/lib/approvalActions";

export const runtime = "edge";

// Applies a queued POS Manager request -- this is the only place its
// underlying edit/delete/buy actually happens. Admin-only.
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
    .prepare("SELECT * FROM pending_approvals WHERE id = ?")
    .bind(params.id)
    .first<any>();
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.status !== "pending") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  const result = await applyPendingApproval(db, row);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await db
    .prepare(
      `UPDATE pending_approvals SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now','localtime') WHERE id = ?`
    )
    .bind(user.username, params.id)
    .run();

  return NextResponse.json({ ok: true });
}
