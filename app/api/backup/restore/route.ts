import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { restoreFromBackup } from "@/lib/backup";

export const runtime = "edge";

// Admin's "Restore from Backup" upload in Settings -- takes the JSON file
// produced by /api/backup/full (or the weekly automatic backup) and
// replaces every business table's contents with what's in that file. See
// restoreFromBackup() in lib/backup.ts for exactly which tables and how
// (delete-then-reinsert, per table, preserving original ids).
//
// The uploaded file's raw text is sent straight as the request body (no
// multipart/form-data) -- the Settings page reads the chosen file with
// File.text() and POSTs that directly, so this route just JSON.parses
// the body.
export async function POST(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
  }

  if (!payload || payload.app !== "iphone-store" || typeof payload.tables !== "object" || !payload.tables) {
    return NextResponse.json(
      { error: "This doesn't look like an iPhone Store backup file" },
      { status: 400 }
    );
  }

  try {
    const restored = await restoreFromBackup(db, payload.tables);
    return NextResponse.json({ ok: true, restored });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Restore failed: " + (e?.message || "unknown error") },
      { status: 500 }
    );
  }
}
