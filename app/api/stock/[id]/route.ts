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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sale = await db
    .prepare("SELECT * FROM sales WHERE phone_id = ? ORDER BY id DESC LIMIT 1")
    .bind(params.id)
    .first();

  return NextResponse.json({ phone, sale });
}

// Lets the user correct any of a stock phone's own details after it's
// already been bought — a typo in the model/IMEI, a wrong RAM/ROM or Buy
// Price, etc. Every field is optional (COALESCE keeps whatever isn't
// sent), so a partial edit only touches what actually changed.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const body: any = await req.json();
  const {
    name_model,
    imei,
    buy_price,
    buy_date,
    ram_rom,
    battery_health,
    bought_from,
    phone_number,
    nid,
  } = body;

  try {
    await db
      .prepare(
        `UPDATE phones SET
          name_model = COALESCE(?, name_model),
          imei = COALESCE(?, imei),
          buy_price = COALESCE(?, buy_price),
          buy_date = COALESCE(?, buy_date),
          ram_rom = COALESCE(?, ram_rom),
          battery_health = COALESCE(?, battery_health),
          bought_from = COALESCE(?, bought_from),
          phone_number = COALESCE(?, phone_number),
          nid = COALESCE(?, nid)
         WHERE id = ?`
      )
      .bind(
        name_model ?? null,
        imei ?? null,
        buy_price ?? null,
        buy_date ?? null,
        ram_rom ?? null,
        battery_health ?? null,
        bought_from ?? null,
        phone_number ?? null,
        nid ?? null,
        params.id
      )
      .run();
  } catch (e: any) {
    // Same partial-unique-index rule as adding a new phone: no two
    // currently-unsold rows may share an IMEI.
    if (String(e.message || e).includes("UNIQUE")) {
      return NextResponse.json(
        { error: "Another phone with this IMEI is already in stock (Unsold)" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

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
