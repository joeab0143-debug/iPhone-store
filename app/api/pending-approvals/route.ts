import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// Lists queued POS Manager requests -- powers both the admin's Approvals
// tab and the POS Manager's own read-only "My Requests" view (same data:
// there's only ever one POS Manager account, so every row here was
// requested_by that account anyway -- no extra per-user filtering needed).
// Any logged-in session (admin or pos_manager) may read this; only the
// approve/reject routes stay admin-only. Defaults to just the still-open
// ones (status=pending); pass ?status=all to also see past
// approved/rejected requests (history view).
export async function GET(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  let query = "SELECT * FROM pending_approvals";
  const binds: string[] = [];
  if (status && status !== "all") {
    query += " WHERE status = ?";
    binds.push(status);
  } else if (!status) {
    query += " WHERE status = 'pending'";
  }
  query += " ORDER BY requested_at DESC";

  const { results } = await db.prepare(query).bind(...binds).all();
  return NextResponse.json({ approvals: results });
}
