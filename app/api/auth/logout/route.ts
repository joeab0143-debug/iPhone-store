import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const db = getDB();
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.prepare("DELETE FROM app_sessions WHERE token = ?").bind(token).run();
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
