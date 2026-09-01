import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const db = getDB();
  const status = req.nextUrl.searchParams.get("status"); // unsold | sold | null(all)
  const imei = req.nextUrl.searchParams.get("imei"); // exact match, used by the Sell sheet's IMEI lookup
  const imeiLike = req.nextUrl.searchParams.get("imei_like"); // partial match — live suggestions while typing
  const limitParam = req.nextUrl.searchParams.get("limit");

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
  const { name_model, imei, buy_price, buy_date, ram_rom, battery_health, bought_from, phone_number, nid } = body;

  if (!name_model || !imei || buy_price === undefined) {
    return NextResponse.json(
      { error: "নাম/মডেল, IMEI এবং ক্রয়মূল্য আবশ্যক" },
      { status: 400 }
    );
  }

  try {
    const result = await db
      .prepare(
        `INSERT INTO phones (name_model, imei, buy_price, buy_date, status, ram_rom, battery_health, bought_from, phone_number, nid)
         VALUES (?, ?, ?, COALESCE(?, datetime('now','localtime')), 'unsold', ?, ?, ?, ?, ?)`
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
        nid || null
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
        { error: "এই IMEI নম্বরের ফোনটি ইতিমধ্যে স্টকে আছে (Unsold)" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "সেভ করা যায়নি" }, { status: 500 });
  }
}
