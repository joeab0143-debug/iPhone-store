import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Sell one or more units of a gadget in one go, all at the same
// manually-entered per-unit price. Can be called repeatedly for the same
// gadget until its quantity runs out — this call itself is also blocked
// from selling more than what's actually left in stock.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const body: any = await req.json();
  const sellPrice = Number(body.sell_price);
  const quantity = Math.floor(Number(body.quantity ?? 1));

  if (!sellPrice || sellPrice <= 0) {
    return NextResponse.json({ error: "সঠিক Sell দাম দিন" }, { status: 400 });
  }
  if (!quantity || quantity < 1) {
    return NextResponse.json({ error: "সঠিক Quantity দিন" }, { status: 400 });
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
    return NextResponse.json({ error: "এন্ট্রি পাওয়া যায়নি" }, { status: 404 });
  }

  const remaining = gadget.quantity - gadget.sold_count;
  if (remaining <= 0) {
    return NextResponse.json({ error: "স্টক শেষ — বিক্রি করার মতো কিছু নেই" }, { status: 409 });
  }
  if (quantity > remaining) {
    return NextResponse.json(
      { error: `স্টকে আছে মাত্র ${remaining}টা — এর বেশি বিক্রি করা যাবে না` },
      { status: 409 }
    );
  }

  const profit = sellPrice - Number(gadget.buy_price);
  const insert = db.prepare(
    `INSERT INTO gadget_sales (gadget_id, sell_price, profit) VALUES (?, ?, ?)`
  );
  // One row per unit, all in a single atomic batch — so a partial failure
  // never leaves the stock count out of sync.
  await db.batch(
    Array.from({ length: quantity }, () => insert.bind(gadget.id, sellPrice, profit))
  );

  return NextResponse.json({ sold: quantity, profit: profit * quantity }, { status: 201 });
}
