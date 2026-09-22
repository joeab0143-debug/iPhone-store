import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

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
  const sale = await db
    .prepare("SELECT phone_id FROM sales WHERE id = ?")
    .bind(params.id)
    .first<{ phone_id: number }>();

  if (!sale) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.prepare("DELETE FROM sales WHERE id = ?").bind(params.id).run();
  await db
    .prepare("UPDATE phones SET status = 'unsold' WHERE id = ?")
    .bind(sale.phone_id)
    .run();

  return NextResponse.json({ ok: true });
}
