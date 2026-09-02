import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { hashPassword, verifyPassword, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// Change the username and/or password. Requires the current password.
// New password (if any) must be at least 6 characters. Every OTHER active
// session is invalidated so a stolen/old device gets logged out, while the
// browser making this request stays logged in.
export async function PATCH(req: NextRequest) {
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

  const body: any = await req.json().catch(() => ({}));
  const { current_password, new_username, new_password } = body;

  if (!current_password) {
    return NextResponse.json({ error: "বর্তমান পাসওয়ার্ড দিন" }, { status: 400 });
  }
  if (new_password && String(new_password).length < 6) {
    return NextResponse.json(
      { error: "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে" },
      { status: 400 }
    );
  }

  const cred: any = await db
    .prepare("SELECT username, password_hash, password_salt FROM app_credentials WHERE id = 1")
    .first();
  if (!cred) {
    return NextResponse.json({ error: "লগইন সেটআপ করা নেই" }, { status: 500 });
  }

  const ok = await verifyPassword(current_password, cred.password_salt, cred.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "বর্তমান পাসওয়ার্ড ভুল" }, { status: 401 });
  }

  const nextUsername = (new_username && String(new_username).trim()) || cred.username;

  if (new_password) {
    const { hash, salt } = await hashPassword(new_password);
    await db
      .prepare(
        `UPDATE app_credentials SET username = ?, password_hash = ?, password_salt = ?, updated_at = datetime('now','localtime') WHERE id = 1`
      )
      .bind(nextUsername, hash, salt)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE app_credentials SET username = ?, updated_at = datetime('now','localtime') WHERE id = 1`
      )
      .bind(nextUsername)
      .run();
  }

  // Log out every other device/session — keep only this one valid.
  await db.prepare("DELETE FROM app_sessions WHERE token != ?").bind(token).run();

  return NextResponse.json({ ok: true, username: nextUsername });
}
