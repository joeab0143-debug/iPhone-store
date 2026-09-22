import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const { sale_id, amount, note, paid_date } = body;

  if (!sale_id || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  const sale = await db
    .prepare("SELECT due_amount, paid_amount FROM sales WHERE id = ?")
    .bind(sale_id)
    .first<{ due_amount: number; paid_amount: number }>();

  if (!sale) {
    return NextResponse.json({ error: "Sale record not found" }, { status: 404 });
  }
  if (Number(amount) > sale.due_amount) {
    return NextResponse.json(
      { error: "Cannot pay more than the due amount" },
      { status: 400 }
    );
  }

  await db
    .prepare(
      `INSERT INTO due_payments (sale_id, amount, paid_date, note)
       VALUES (?, ?, COALESCE(?, datetime('now','localtime')), ?)`
    )
    .bind(sale_id, amount, paid_date || null, note || null)
    .run();

  const newDue = sale.due_amount - Number(amount);
  const newPaid = sale.paid_amount + Number(amount);

  await db
    .prepare("UPDATE sales SET due_amount = ?, paid_amount = ? WHERE id = ?")
    .bind(newDue, newPaid, sale_id)
    .run();

  return NextResponse.json({ ok: true, due_amount: newDue, paid_amount: newPaid });
}
