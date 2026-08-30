import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const phone = await db
    .prepare("SELECT * FROM phones WHERE id = ?")
    .bind(params.id)
    .first();

  if (!phone) {
    return NextResponse.json({ error: "পাওয়া যায়নি" }, { status: 404 });
  }

  const sale = await db
    .prepare("SELECT * FROM sales WHERE phone_id = ? ORDER BY id DESC LIMIT 1")
    .bind(params.id)
    .first();

  return NextResponse.json({ phone, sale });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const body: any = await req.json();
  const { name_model, imei, buy_price, buy_date } = body;

  await db
    .prepare(
      `UPDATE phones SET
        name_model = COALESCE(?, name_model),
        imei = COALESCE(?, imei),
        buy_price = COALESCE(?, buy_price),
        buy_date = COALESCE(?, buy_date)
       WHERE id = ?`
    )
    .bind(name_model ?? null, imei ?? null, buy_price ?? null, buy_date ?? null, params.id)
    .run();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  await db.prepare("DELETE FROM phones WHERE id = ?").bind(params.id).run();
  return NextResponse.json({ ok: true });
}
