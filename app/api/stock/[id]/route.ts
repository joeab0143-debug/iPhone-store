import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { queueApproval } from "@/lib/approvals";
import { applyPhoneEdit, applyPhoneDelete } from "@/lib/approvalActions";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const phone = await db
    .prepare("SELECT * FROM phones WHERE id = ?")
    .bind(params.id)
    .first();

  if (!phone) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sale = await db
    .prepare("SELECT * FROM sales WHERE phone_id = ? ORDER BY id DESC LIMIT 1")
    .bind(params.id)
    .first();

  return NextResponse.json({ phone, sale });
}

// Lets the user correct any of a stock phone's own details after it's
// already been bought -- a typo in the model/IMEI, a wrong RAM/ROM or Buy
// Price, etc. Every field is optional (COALESCE keeps whatever isn't
// sent), so a partial edit only touches what actually changed.
//
// A POS Manager's edit doesn't apply here -- it's queued in
// pending_approvals instead, and only takes effect once an admin approves
// it from the Approvals tab.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body: any = await req.json();

  if (user.role === "pos_manager") {
    const current = await db
      .prepare("SELECT name_model, imei FROM phones WHERE id = ?")
      .bind(params.id)
      .first<{ name_model: string; imei: string }>();
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const id = await queueApproval(db, {
      actionType: "edit",
      resourceType: "phone",
      resourceId: params.id,
      resourceLabel: `${body.name_model || current.name_model} (IMEI: ${body.imei || current.imei})`,
      payload: body,
      requestedBy: user.username,
    });
    return NextResponse.json(
      { pending: true, approvalId: id, message: "Submitted for admin approval" },
      { status: 202 }
    );
  }

  const result = await applyPhoneEdit(db, params.id, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  if (user.role === "pos_manager") {
    const current = await db
      .prepare("SELECT name_model, imei FROM phones WHERE id = ?")
      .bind(params.id)
      .first<{ name_model: string; imei: string }>();
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const id = await queueApproval(db, {
      actionType: "delete",
      resourceType: "phone",
      resourceId: params.id,
      resourceLabel: `${current.name_model} (IMEI: ${current.imei})`,
      requestedBy: user.username,
    });
    return NextResponse.json(
      { pending: true, approvalId: id, message: "Submitted for admin approval" },
      { status: 202 }
    );
  }

  const result = await applyPhoneDelete(db, params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
