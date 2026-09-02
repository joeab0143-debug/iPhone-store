import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const db = getDB();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "লগইন করা নেই" }, { status: 401 });
  }

  const session = await db
    .prepare("SELECT 1 FROM app_sessions WHERE token = ? AND expires_at > datetime('now','localtime')")
    .bind(token)
    .first();
  if (!session) {
    return NextResponse.json({ error: "লগইন করা নেই" }, { status: 401 });
  }

  const cred: any = await db
    .prepare("SELECT username FROM app_credentials WHERE id = 1")
    .first();

  return NextResponse.json({ username: cred?.username || "" });
}
