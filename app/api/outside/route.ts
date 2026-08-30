import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const db = getDB();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  let query = "SELECT * FROM outside_deals WHERE 1=1";
  const binds: string[] = [];
  if (from) {
    query += " AND date(deal_date) >= date(?)";
    binds.push(from);
  }
  if (to) {
    query += " AND date(deal_date) <= date(?)";
    binds.push(to);
  }
  query += " ORDER BY deal_date DESC";

  const { results } = await db.prepare(query).bind(...binds).all();
  return NextResponse.json({ deals: results });
}

export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const {
    name,
    model,
    imei,
    buy_price,
    nid,
    phone_number,
    sell_price,
    profit,
    deal_date,
  } = body;

  if (!name) {
    return NextResponse.json({ error: "নাম আবশ্যক" }, { status: 400 });
  }

  // profit: if sell_price given, compute; otherwise use manually entered profit
  const computedProfit =
    sell_price !== undefined && sell_price !== null && sell_price !== ""
      ? Number(sell_price) - Number(buy_price || 0)
      : Number(profit || 0);

  const result = await db
    .prepare(
      `INSERT INTO outside_deals
        (name, model, imei, buy_price, nid, phone_number, sell_price, profit, deal_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now','localtime')))`
    )
    .bind(
      name,
      model || null,
      imei || null,
      buy_price || 0,
      nid || null,
      phone_number || null,
      sell_price ?? null,
      computedProfit,
      deal_date || null
    )
    .run();

  return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}
