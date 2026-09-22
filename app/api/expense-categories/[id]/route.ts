import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { queueApproval } from "@/lib/approvals";
import { applyExpenseCategoryEdit, applyExpenseCategoryDelete } from "@/lib/approvalActions";

export const runtime = "edge";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { name, designation }: any = await req.json();

  if (user.role === "pos_manager") {
    const current = await db
      .prepare("SELECT name, designation FROM expense_categories WHERE id = ?")
      .bind(params.id)
      .first<{ name: string; designation: string }>();
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const id = await queueApproval(db, {
      actionType: "edit",
      resourceType: "expense_category",
      resourceId: params.id,
      resourceLabel: `${name || current.name} (${designation || current.designation})`,
      payload: { name, designation },
      requestedBy: user.username,
    });
    return NextResponse.json(
      { pending: true, approvalId: id, message: "Submitted for admin approval" },
      { status: 202 }
    );
  }

  const result = await applyExpenseCategoryEdit(db, params.id, { name, designation });
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
      .prepare("SELECT name, designation FROM expense_categories WHERE id = ?")
      .bind(params.id)
      .first<{ name: string; designation: string }>();
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const id = await queueApproval(db, {
      actionType: "delete",
      resourceType: "expense_category",
      resourceId: params.id,
      resourceLabel: `${current.name} (${current.designation})`,
      requestedBy: user.username,
    });
    return NextResponse.json(
      { pending: true, approvalId: id, message: "Submitted for admin approval" },
      { status: 202 }
    );
  }

  const result = await applyExpenseCategoryDelete(db, params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
