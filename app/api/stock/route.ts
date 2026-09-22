import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const db = getDB();
  const status = req.nextUrl.searchParams.get("status"); // unsold | sold | null(all)
  const imei = req.nextUrl.searchParams.get("imei"); // exact match, used by the Sell sheet's IMEI lookup
  const imeiLike = req.nextUrl.searchParams.get("imei_like"); // partial match — live suggestions while typing
  const limitParam = req.nextUrl.searchParams.get("limit");
  // from/to (YYYY-MM-DD, inclusive) — used by the Buy sheet's "Download
  // Purchase History" so the owner can pull just a date range instead of everything.
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  let query = "SELECT * FROM phones WHERE 1=1";
  const binds: string[] = [];
  if (status === "unsold" || status === "sold") {
    query += " AND status = ?";
    binds.push(status);
  }
  if (imei) {
    query += " AND imei = ?";
    binds.push(imei);
  }
  if (imeiLike) {
    query += " AND imei LIKE ?";
    binds.push(`%${imeiLike}%`);
  }
  if (from) {
    query += " AND date(buy_date) >= date(?)";
    binds.push(from);
  }
  if (to) {
    query += " AND date(buy_date) <= date(?)";
    binds.push(to);
  }
  query += " ORDER BY created_at DESC";
  if (imeiLike) {
    const limit = Math.min(Math.max(Number(limitParam) || 8, 1), 20);
    query += ` LIMIT ${limit}`;
  }

  const { results } = await db
    .prepare(query)
    .bind(...binds)
    .all();

  return NextResponse.json({ phones: results });
}

export async function POST(req: NextRequest) {
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
    stock_type,
    seller_type,
    nid_front_photo,
    nid_back_photo,
    person_photo,
  } = body;

  if (!name_model || !imei || buy_price === undefined) {
    return NextResponse.json(
      { error: "Name/model, IMEI, and buy price are required" },
      { status: 400 }
    );
  }

  // Anything other than the literal "outside" stays the regular/default
  // stock type — so callers that don't send this field at all (e.g. the
  // Sell sheet's auto-create-on-unknown-IMEI path) are unaffected.
  const stockType = stock_type === "outside" ? "outside" : "regular";

  // "individual" (personal phone) requires the NID + person photos, captured
  // and compressed on the client; anything else stays the default supplier
  // purchase and carries no photos.
  const sellerType = seller_type === "individual" ? "individual" : "supplier";

  try {
    const result = await db
      .prepare(
        `INSERT INTO phones (name_model, imei, buy_price, buy_date, status, ram_rom, battery_health, bought_from, phone_number, nid, stock_type, seller_type, nid_front_photo, nid_back_photo, person_photo)
         VALUES (?, ?, ?, COALESCE(?, datetime('now','localtime')), 'unsold', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        name_model,
        imei,
        buy_price,
        buy_date || null,
        ram_rom || null,
        battery_health || null,
        bought_from || null,
        phone_number || null,
        nid || null,
        stockType,
        sellerType,
        sellerType === "individual" ? nid_front_photo || null : null,
        sellerType === "individual" ? nid_back_photo || null : null,
        sellerType === "individual" ? person_photo || null : null
      )
      .run();

    return NextResponse.json(
      { id: result.meta.last_row_id },
      { status: 201 }
    );
  } catch (e: any) {
    // The DB only enforces uniqueness among currently-unsold rows (see
    // migration 0006) — this only fires when the same IMEI is already sitting
    // unsold in stock. A sold phone's IMEI can always be re-entered.
    if (String(e.message || e).includes("UNIQUE")) {
      return NextResponse.json(
        { error: "A phone with this IMEI is already in stock (Unsold)" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
