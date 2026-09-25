import { NextRequest, NextResponse } from "next/server";
import { getDB, getEnv } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// Streams one previously-stored weekly backup back to the admin, from the
// list in Settings. Session-protected (unlike /api/backup/run, which uses
// the shared secret because its caller has no session at all).
export async function GET(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key || !key.startsWith("backups/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const env = getEnv();
  if (!env.BACKUPS) {
    return NextResponse.json(
      { error: "No BACKUPS R2 bucket is bound to this deployment" },
      { status: 500 }
    );
  }

  const obj = await env.BACKUPS.get(key);
  if (!obj) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = key.split("/").pop() || "backup.json";
  return new NextResponse(obj.body as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
