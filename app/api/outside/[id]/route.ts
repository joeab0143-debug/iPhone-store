import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const body: any = await req.json();
  const { name, model, imei, buy_price, nid, phone_number, sell_price, profit, deal_date } = body;

  const computedProfit =
    sell_price !== undefined && sell_price !== null && sell_price !== ""
      ? Number(sell_price) - Number(buy_price || 0)
      : profit;

  await db
    .prepare(
      `UPDATE outside_deals SET
        name = COALESCE(?, name),
        model = COALESCE(?, model),
        imei = COALESCE(?, imei),
        buy_price = COALESCE(?, buy_price),
        nid = COALESCE(?, nid),
        phone_number = COALESCE(?, phone_number),
        sell_price = COALESCE(?, sell_price),
        profit = COALESCE(?, profit),
        deal_date = COALESCE(?, deal_date)
       WHERE id = ?`
    )
    .bind(
      name ?? null,
      model ?? null,
      imei ?? null,
      buy_price ?? null,
      nid ?? null,
      phone_number ?? null,
      sell_price ?? null,
      computedProfit ?? null,
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
