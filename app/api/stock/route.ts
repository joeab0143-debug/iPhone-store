import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const db = getDB();
  const status = req.nextUrl.searchParams.get("status"); // unsold | sold | null(all)
  const imei = req.nextUrl.searchParams.get("imei"); // exact match, used by the Sell sheet's IMEI lookup

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
  query += " ORDER BY created_at DESC";

  const { results } = await db
    .prepare(query)
    .bind(...binds)
    .all();

  return NextResponse.json({ phones: results });
}

export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const { name_model, imei, buy_price, buy_date, ram_rom, bought_from, phone_number, nid } = body;

  if (!name_model || !imei || buy_price === undefined) {
    return NextResponse.json(
      { error: "নাম/মডেল, IMEI এবং ক্রয়মূল্য আবশ্যক" },
      { status: 400 }
    );
  }

  try {
    const result = await db
      .prepare(
        `INSERT INTO phones (name_model, imei, buy_price, buy_date, status, ram_rom, bought_from, phone_number, nid)
         VALUES (?, ?, ?, COALESCE(?, datetime('now','localtime')), 'unsold', ?, ?, ?, ?)`
      )
      .bind(
        name_model,
        imei,
        buy_price,
        buy_date || null,
        ram_rom || null,
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
    if (String(e.message || e).includes("UNIQUE")) {
      return NextResponse.json(
        { error: "এই IMEI নম্বরটি আগে থেকেই স্টকে আছে" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "সেভ করা যায়নি" }, { status: 500 });
  }
}
