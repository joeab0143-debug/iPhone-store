import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, hashPassword, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// The POS Manager account: an optional second, restricted login the shop
// owner (admin) sets up from Settings. All three methods here are
// admin-only -- a POS Manager can never see or change their own account
// through this route.

export async function GET(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const cred = await db
    .prepare("SELECT username FROM pos_manager_credentials WHERE id = 1")
    .first<{ username: string }>();
  return NextResponse.json({ exists: !!cred, username: cred?.username || null });
}

// Creates the POS Manager account if none exists yet, or resets its
// username/password if one already does. Every currently-logged-in POS
// Manager session is invalidated, same as changing the admin's own
// password logs out other devices.
export async function POST(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body: any = await req.json().catch(() => ({}));
  const { username, password } = body;

  if (!username || !String(username).trim()) {
    return NextResponse.json({ error: "Enter a name" }, { status: 400 });
  }
  if (!password || String(password).length < 6) {
    return NextResponse.json(
      { error: "New password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const { hash, salt } = await hashPassword(password);
  await db
    .prepare(
      `INSERT INTO pos_manager_credentials (id, username, password_hash, password_salt)
       VALUES (1, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         username = excluded.username,
         password_hash = excluded.password_hash,
         password_salt = excluded.password_salt,
         updated_at = datetime('now','localtime')`
    )
    .bind(String(username).trim(), hash, salt)
    .run();

  await db.prepare("DELETE FROM app_sessions WHERE role = 'pos_manager'").run();

  return NextResponse.json({ ok: true, username: String(username).trim() });
}

// Removes the POS Manager account entirely, logging out any active POS
// Manager session immediately. Pending approval requests already submitted
// stay in the Approvals tab for the admin to review as usual.
export async function DELETE(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  await db.prepare("DELETE FROM pos_manager_credentials WHERE id = 1").run();
  await db.prepare("DELETE FROM app_sessions WHERE role = 'pos_manager'").run();

  return NextResponse.json({ ok: true });
}
