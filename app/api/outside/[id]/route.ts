import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { queueApproval } from "@/lib/approvals";
import { applyOutsideDealEdit, applyOutsideDealDelete } from "@/lib/approvalActions";

export const runtime = "edge";

// Also used by the Used Phone sheet to "close" a purchase: it PATCHes
// { sell_price, customer_name, customer_phone, status: "sold", sell_date }
// onto the outside_deals row that the Buy sheet created earlier.
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

  const current = await db
    .prepare("SELECT name, model, imei FROM outside_deals WHERE id = ?")
    .bind(params.id)
    .first<{ name: string; model: string; imei: string }>();
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.role === "pos_manager") {
    const id = await queueApproval(db, {
      actionType: "edit",
      resourceType: "outside_deal",
      resourceId: params.id,
      resourceLabel: `${body.model || current.model || current.name} (IMEI: ${body.imei || current.imei})`,
      payload: body,
      requestedBy: user.username,
    });
    return NextResponse.json(
      { pending: true, approvalId: id, message: "Submitted for admin approval" },
      { status: 202 }
    );
  }

  const result = await applyOutsideDealEdit(db, params.id, body);
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
      .prepare("SELECT name, model, imei FROM outside_deals WHERE id = ?")
      .bind(params.id)
      .first<{ name: string; model: string; imei: string }>();
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const id = await queueApproval(db, {
      actionType: "delete",
      resourceType: "outside_deal",
      resourceId: params.id,
      resourceLabel: `${current.model || current.name} (IMEI: ${current.imei})`,
      requestedBy: user.username,
    });
    return NextResponse.json(
      { pending: true, approvalId: id, message: "Submitted for admin approval" },
      { status: 202 }
    );
  }

  const result = await applyOutsideDealDelete(db, params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
