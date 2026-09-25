import { NextRequest, NextResponse } from "next/server";
import { getDB, getEnv } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// Lists the automatic weekly backups sitting in R2, for the Settings
// page's "Weekly Automatic Backups" list. `configured: false` means no
// BACKUPS bucket is bound yet -- the Settings UI uses that to show setup
// guidance instead of an empty list.
export async function GET(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const env = getEnv();
  if (!env.BACKUPS) {
    return NextResponse.json({ backups: [], configured: false });
  }

  const listed = await env.BACKUPS.list({ prefix: "backups/" });
  const backups = listed.objects
    .map((o) => ({ key: o.key, size: o.size, uploaded: o.uploaded }))
    .sort((a, b) => (a.uploaded < b.uploaded ? 1 : -1));

  return NextResponse.json({ backups, configured: true });
}
