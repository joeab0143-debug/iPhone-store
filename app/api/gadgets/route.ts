import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Gadgets & Accessories — a standalone buy/sell log. On purpose, nothing
// here is ever summed into /api/dashboard or /api/summary; it's a private
// record the user only sees inside this tab.
//
// Each gadget is entered with a quantity (how many units were bought).
// Units are then sold one at a time via POST /api/gadgets/[id]/sell, each
// with its own sell price recorded in gadget_sales. Remaining stock =
// quantity - (number of sale rows for that gadget).
export async function GET() {
  const db = getDB();
  const { results } = await db
    .prepare(
      `SELECT g.*,
        COALESCE(s.sold_count, 0) AS sold_count,
        COALESCE(s.total_sell, 0) AS total_sell,
        COALESCE(s.total_profit, 0) AS total_profit
       FROM gadgets g
       LEFT JOIN (
         SELECT gadget_id, COUNT(*) AS sold_count, SUM(sell_price) AS total_sell, SUM(profit) AS total_profit
         FROM gadget_sales
         GROUP BY gadget_id
       ) s ON s.gadget_id = g.id
       ORDER BY g.created_at DESC`
    )
    .all();

  return NextResponse.json({ gadgets: results });
}

export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const { buy_name, buy_price, quantity } = body;

  if (!buy_name) {
    return NextResponse.json({ error: "Enter a name" }, { status: 400 });
  }
  const qty = Number(quantity || 1);
  if (!qty || qty < 1) {
    return NextResponse.json({ error: "Enter a valid Quantity" }, { status: 400 });
  }

  const result = await db
    .prepare(
      `INSERT INTO gadgets (buy_name, buy_price, quantity) VALUES (?, ?, ?)`
    )
    .bind(buy_name, Number(buy_price || 0), qty)
    .run();

  return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}
