import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { buildBackupPayload, backupFilename } from "@/lib/backup";

export const runtime = "edge";

// The admin's "Download Full Backup Now" button in Settings -- builds a
// fresh export on the spot and hands it back as a file download. No
// storage involved, so this works the moment the app is deployed, unlike
// the automatic weekly copy in /api/backup/run which needs an R2 bucket.
export async function GET(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const payload = await buildBackupPayload(db);
  const body = JSON.stringify(payload, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${backupFilename()}"`,
    },
  });
}
