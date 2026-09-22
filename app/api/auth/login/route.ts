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

  const typedUser = String(username).trim().toLowerCase();

  const adminCred: any = await db
    .prepare("SELECT username, password_hash, password_salt FROM app_credentials WHERE id = 1")
    .first();

  if (!adminCred) {
    return NextResponse.json({ error: "Login is not set up" }, { status: 500 });
  }

  let role: "admin" | "pos_manager" | null = null;

  if (typedUser === String(adminCred.username).trim().toLowerCase()) {
    const ok = await verifyPassword(password, adminCred.password_salt, adminCred.password_hash);
    if (ok) role = "admin";
  }

  // Not the admin (or wrong password for it) -- try the POS Manager
  // account, if one has been created from Settings.
  if (!role) {
    const posCred: any = await db
      .prepare("SELECT username, password_hash, password_salt FROM pos_manager_credentials WHERE id = 1")
      .first();
    if (posCred && typedUser === String(posCred.username).trim().toLowerCase()) {
      const ok = await verifyPassword(password, posCred.password_salt, posCred.password_hash);
      if (ok) role = "pos_manager";
    }
  }

  if (!role) {
    return NextResponse.json({ error: "Incorrect user ID or password" }, { status: 401 });
  }

  const token = newSessionToken();
  await db
    .prepare(
      `INSERT INTO app_sessions (token, expires_at, role)
       VALUES (?, datetime('now','localtime', '+${SESSION_DAYS} days'), ?)`
    )
    .bind(token, role)
    .run();

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
