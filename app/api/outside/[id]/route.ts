import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Also used by the Used Phone sheet to "close" a purchase: it PATCHes
// { sell_price, customer_name, customer_phone, status: "sold", sell_date }
// onto the outside_deals row that the Buy sheet created earlier.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
    status,
    customer_name,
    customer_phone,
    sell_date,
  } = body;

  const current = await db
    .prepare("SELECT buy_price FROM outside_deals WHERE id = ?")
    .bind(params.id)
    .first<{ buy_price: number }>();

  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const effectiveBuyPrice = buy_price ?? current.buy_price;
  const computedProfit =
    sell_price !== undefined && sell_price !== null && sell_price !== ""
      ? Number(sell_price) - Number(effectiveBuyPrice || 0)
      : profit;

  await db
    .prepare(
      `UPDATE outside_deals SET
        name = COALESCE(?, name),
        model = COALESCE(?, model),
        imei = COALESCE(?, imei),
        ram_rom = COALESCE(?, ram_rom),
        bought_from = COALESCE(?, bought_from),
        buy_price = COALESCE(?, buy_price),
        nid = COALESCE(?, nid),
        phone_number = COALESCE(?, phone_number),
        sell_price = COALESCE(?, sell_price),
        profit = COALESCE(?, profit),
        status = COALESCE(?, status),
        customer_name = COALESCE(?, customer_name),
        customer_phone = COALESCE(?, customer_phone),
        sell_date = COALESCE(?, sell_date),
        deal_date = COALESCE(?, deal_date)
       WHERE id = ?`
    )
    .bind(
      name ?? null,
      model ?? null,
      imei ?? null,
      ram_rom ?? null,
      bought_from ?? null,
      buy_price ?? null,
      nid ?? null,
      phone_number ?? null,
      sell_price ?? null,
      computedProfit ?? null,
      status ?? null,
      customer_name ?? null,
      customer_phone ?? null,
      sell_date ?? null,
      deal_date ?? null,
      params.id
    )
    .run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  await db.prepare("DELETE FROM outside_deals WHERE id = ?").bind(params.id).run();
  return NextResponse.json({ ok: true });
}
