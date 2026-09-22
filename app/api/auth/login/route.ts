import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { newSessionToken, verifyPassword, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json().catch(() => ({}));
  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json({ error: "Enter user ID and password" }, { status: 400 });
  }

  const cred: any = await db
    .prepare("SELECT username, password_hash, password_salt FROM app_credentials WHERE id = 1")
    .first();

  if (!cred) {
    return NextResponse.json({ error: "Login is not set up" }, { status: 500 });
  }

  if (
    String(username).trim().toLowerCase() !== String(cred.username).trim().toLowerCase()
  ) {
    return NextResponse.json({ error: "Incorrect user ID or password" }, { status: 401 });
  }

  const ok = await verifyPassword(password, cred.password_salt, cred.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect user ID or password" }, { status: 401 });
  }

  const token = newSessionToken();
  await db
    .prepare(
      `INSERT INTO app_sessions (token, expires_at)
       VALUES (?, datetime('now','localtime', '+${SESSION_DAYS} days'))`
    )
    .bind(token)
    .run();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
