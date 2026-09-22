import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { queueApproval } from "@/lib/approvals";
import { applyGadgetDelete } from "@/lib/approvalActions";

export const runtime = "edge";

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
      .prepare("SELECT buy_name FROM gadgets WHERE id = ?")
      .bind(params.id)
      .first<{ buy_name: string }>();
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const id = await queueApproval(db, {
      actionType: "delete",
      resourceType: "gadget",
      resourceId: params.id,
      resourceLabel: current.buy_name,
      requestedBy: user.username,
    });
    return NextResponse.json(
      { pending: true, approvalId: id, message: "Submitted for admin approval" },
      { status: 202 }
    );
  }

  const result = await applyGadgetDelete(db, params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
