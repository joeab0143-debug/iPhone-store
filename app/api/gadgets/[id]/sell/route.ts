import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Sell ONE unit of a gadget at a manually-entered price. Can be called
// repeatedly for the same gadget until its quantity runs out.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const body: any = await req.json();
  const sellPrice = Number(body.sell_price);

  if (!sellPrice || sellPrice <= 0) {
    return NextResponse.json({ error: "সঠিক Sell দাম দিন" }, { status: 400 });
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
  if (gadget.sold_count >= gadget.quantity) {
    return NextResponse.json({ error: "স্টক শেষ — বিক্রি করার মতো কিছু নেই" }, { status: 409 });
  }

  const profit = sellPrice - Number(gadget.buy_price);
  const result = await db
    .prepare(
      `INSERT INTO gadget_sales (gadget_id, sell_price, profit) VALUES (?, ?, ?)`
    )
    .bind(gadget.id, sellPrice, profit)
    .run();

  return NextResponse.json({ id: result.meta.last_row_id, profit }, { status: 201 });
}
