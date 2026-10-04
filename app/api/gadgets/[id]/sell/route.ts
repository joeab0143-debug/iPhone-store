import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Sell one or more units of a gadget in one go, all at the same
// manually-entered per-unit price. Can be called repeatedly for the same
// gadget until its quantity runs out — this call itself is also blocked
// from selling more than what's actually left in stock.
//
// Due (partial-payment) sales are only allowed one unit at a time -- a due
// balance belongs to one specific customer, and splitting it across
// several bulk-sold units would need a way to divide it back up later.
// Selling several units at once still works exactly as before, just
// always paid in full.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const body: any = await req.json();
  const sellPrice = Number(body.sell_price);
  const quantity = Math.floor(Number(body.quantity ?? 1));
  const isDueFlag = body.is_due && quantity === 1 ? 1 : 0;
  const customerName = body.customer_name || null;
  const customerPhone = body.customer_phone || null;
  const sellDate = body.sell_date || null;

  if (!sellPrice || sellPrice <= 0) {
    return NextResponse.json({ error: "Enter a valid Sell price" }, { status: 400 });
  }
  if (!quantity || quantity < 1) {
    return NextResponse.json({ error: "Enter a valid Quantity" }, { status: 400 });
  }
  if (isDueFlag && !customerName) {
    return NextResponse.json({ error: "Customer name is required for a due sale" }, { status: 400 });
  }

  const gadget = await db
    .prepare(
      `SELECT g.*, COALESCE(s.sold_count, 0) AS sold_count
       FROM gadgets g
       LEFT JOIN (SELECT gadget_id, COUNT(*) AS sold_count FROM gadget_sales GROUP BY gadget_id) s
         ON s.gadget_id = g.id
       WHERE g.id = ?`
    )
    .bind(params.id)
    .first<{ id: number; buy_price: number; quantity: number; sold_count: number }>();

  if (!gadget) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const remaining = gadget.quantity - gadget.sold_count;
  if (remaining <= 0) {
    return NextResponse.json({ error: "Out of stock — nothing to sell" }, { status: 409 });
  }
  if (quantity > remaining) {
    return NextResponse.json(
      { error: `Only ${remaining} left in stock — cannot sell more than that` },
      { status: 409 }
    );
  }

  const profit = sellPrice - Number(gadget.buy_price);
  const paidAmount = isDueFlag ? Number(body.paid_now || 0) : sellPrice;
  const dueAmount = isDueFlag ? sellPrice - paidAmount : 0;
  if (isDueFlag && (paidAmount < 0 || paidAmount > sellPrice)) {
    return NextResponse.json({ error: "Enter a valid paid amount" }, { status: 400 });
  }

  const insert = db.prepare(
    `INSERT INTO gadget_sales (gadget_id, sell_price, profit, customer_name, customer_phone, is_due, due_amount, paid_amount, sold_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now','localtime')))`
  );
  // One row per unit, all in a single atomic batch — so a partial failure
  // never leaves the stock count out of sync. Due sales are always
  // quantity 1, so this loop only ever runs once for those.
  await db.batch(
    Array.from({ length: quantity }, () =>
      insert.bind(gadget.id, sellPrice, profit, customerName, customerPhone, isDueFlag, dueAmount, paidAmount, sellDate)
    )
  );

  return NextResponse.json({ sold: quantity, profit: profit * quantity }, { status: 201 });
}
