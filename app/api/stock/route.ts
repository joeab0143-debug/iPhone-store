import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const db = getDB();
  const status = req.nextUrl.searchParams.get("status"); // unsold | sold | null(all)

  let query = "SELECT * FROM phones";
  const binds: string[] = [];
  if (status === "unsold" || status === "sold") {
    query += " WHERE status = ?";
    binds.push(status);
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
  const { name_model, imei, buy_price, buy_date } = body;

  if (!name_model || !imei || buy_price === undefined) {
    return NextResponse.json(
      { error: "নাম/মডেল, IMEI এবং ক্রয়মূল্য আবশ্যক" },
      { status: 400 }
    );
  }

  try {
    const result = await db
      .prepare(
        `INSERT INTO phones (name_model, imei, buy_price, buy_date, status)
         VALUES (?, ?, ?, COALESCE(?, datetime('now','localtime')), 'unsold')`
      )
      .bind(name_model, imei, buy_price, buy_date || null)
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
