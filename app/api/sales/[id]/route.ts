import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { queueApproval } from "@/lib/approvals";
import { applySaleDelete } from "@/lib/approvalActions";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const sale = await db
    .prepare(
      `SELECT s.*, p.name_model, p.imei, p.buy_price
       FROM sales s JOIN phones p ON p.id = s.phone_id
       WHERE s.id = ?`
    )
    .bind(params.id)
    .first();

  if (!sale) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { results: payments } = await db
    .prepare("SELECT * FROM due_payments WHERE sale_id = ? ORDER BY paid_date ASC")
    .bind(params.id)
    .all();

  return NextResponse.json({ sale, payments });
}

// Undo a sale entirely: removes the sale record and puts the phone back to unsold
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const sale = await db
    .prepare(
      `SELECT s.phone_id, p.name_model, p.imei
       FROM sales s JOIN phones p ON p.id = s.phone_id
       WHERE s.id = ?`
    )
    .bind(params.id)
    .first<{ phone_id: number; name_model: string; imei: string }>();

  if (!sale) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (user.role === "pos_manager") {
    const id = await queueApproval(db, {
      actionType: "delete",
      resourceType: "sale",
      resourceId: params.id,
      resourceLabel: `${sale.name_model} (IMEI: ${sale.imei})`,
      requestedBy: user.username,
    });
    return NextResponse.json(
      { pending: true, approvalId: id, message: "Submitted for admin approval" },
      { status: 202 }
    );
  }

  const result = await applySaleDelete(db, params.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
