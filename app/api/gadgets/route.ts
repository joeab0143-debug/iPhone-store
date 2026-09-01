import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Gadgets & Accessories — a standalone buy/sell log. On purpose, nothing
// here is ever summed into /api/dashboard or /api/summary; it's a private
// record the user only sees inside this tab.
export async function GET() {
  const db = getDB();
  const { results } = await db
    .prepare("SELECT * FROM gadgets ORDER BY created_at DESC")
    .all();
  return NextResponse.json({ gadgets: results });
}

export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const { buy_name, buy_price, sell_price } = body;

  if (!buy_name) {
    return NextResponse.json({ error: "নাম দিন" }, { status: 400 });
  }

  const result = await db
    .prepare(
      `INSERT INTO gadgets (buy_name, buy_price, sell_price) VALUES (?, ?, ?)`
    )
    .bind(buy_name, Number(buy_price || 0), Number(sell_price || 0))
    .run();

  return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}
