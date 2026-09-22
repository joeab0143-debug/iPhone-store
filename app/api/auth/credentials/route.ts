import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { hashPassword, verifyPassword, getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// Change the caller's own username and/or password -- works for either
// role, each against its own table (admin -> app_credentials, POS Manager
// -> pos_manager_credentials). Requires the current password. New password
// (if any) must be at least 6 characters. Every OTHER active session for
// this same role is invalidated so a stolen/old device gets logged out,
// while the browser making this request stays logged in.
export async function PATCH(req: NextRequest) {
  const db = getDB();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = await getSessionUser(db, token);
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body: any = await req.json().catch(() => ({}));
  const { current_password, new_username, new_password } = body;

  if (!current_password) {
    return NextResponse.json({ error: "Enter your current password" }, { status: 400 });
  }
  if (new_password && String(new_password).length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const table = user.role === "admin" ? "app_credentials" : "pos_manager_credentials";

  const cred: any = await db
    .prepare(`SELECT username, password_hash, password_salt FROM ${table} WHERE id = 1`)
    .first();
  if (!cred) {
    return NextResponse.json({ error: "Login is not set up" }, { status: 500 });
  }

  const ok = await verifyPassword(current_password, cred.password_salt, cred.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const nextUsername = (new_username && String(new_username).trim()) || cred.username;

  if (new_password) {
    const { hash, salt } = await hashPassword(new_password);
    await db
      .prepare(
        `UPDATE ${table} SET username = ?, password_hash = ?, password_salt = ?, updated_at = datetime('now','localtime') WHERE id = 1`
      )
      .bind(nextUsername, hash, salt)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE ${table} SET username = ?, updated_at = datetime('now','localtime') WHERE id = 1`
      )
      .bind(nextUsername)
      .run();
  }

  // Log out every other device/session for this same role -- keep only
  // this one valid. The other role's sessions are untouched.
  await db
    .prepare("DELETE FROM app_sessions WHERE role = ? AND token != ?")
    .bind(user.role, token)
    .run();

  return NextResponse.json({ ok: true, username: nextUsername });
}
