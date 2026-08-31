import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const db = getDB();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const status = req.nextUrl.searchParams.get("status"); // unsold | sold
  const imei = req.nextUrl.searchParams.get("imei"); // exact match, used by the Outside Sell sheet's IMEI lookup

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
  if (status === "unsold" || status === "sold") {
    query += " AND status = ?";
    binds.push(status);
  }
  if (imei) {
    query += " AND imei = ?";
    binds.push(imei);
  }
  query += " ORDER BY deal_date DESC";

  const { results } = await db.prepare(query).bind(...binds).all();
  return NextResponse.json({ deals: results });
}

// Outside Sell is now a standalone 3-field profit log (Model, IMEI, Profit),
// so a row usually arrives with just those + status:"sold". The extra
// columns (ram_rom, bought_from, buy_price, nid, phone_number, sell_price)
// are legacy from the old staged-Buy flow and stay optional for backward
// compatibility.
export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const {
    name,
    model,
    imei,
    ram_rom,
    bought_from,
    buy_price,
    nid,
    phone_number,
    sell_price,
    profit,
    deal_date,
    buy_date,
    status,
  } = body;

  const identifier = model || imei || bought_from || name;
  if (!identifier) {
    return NextResponse.json({ error: "Model অথবা IMEI দিন" }, { status: 400 });
  }

  // profit: if sell_price given, compute; otherwise use manually entered profit
  const computedProfit =
    sell_price !== undefined && sell_price !== null && sell_price !== ""
      ? Number(sell_price) - Number(buy_price || 0)
      : Number(profit || 0);

  const rowStatus = status || (sell_price !== undefined && sell_price !== null && sell_price !== "" ? "sold" : "unsold");
  const sellDate = rowStatus === "sold" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;

  const result = await db
    .prepare(
      `INSERT INTO outside_deals
        (name, model, imei, ram_rom, bought_from, buy_price, nid, phone_number, sell_price, profit, status, deal_date, sell_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now','localtime')), ?)`
    )
    .bind(
      name || identifier,
      model || null,
      imei || null,
      ram_rom || null,
      bought_from || null,
      buy_price || 0,
      nid || null,
      phone_number || null,
      sell_price ?? null,
      computedProfit,
      rowStatus,
      buy_date || deal_date || null,
      sellDate
    )
    .run();

  return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}
