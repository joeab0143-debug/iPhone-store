import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const db = getDB();
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const dueOnly = req.nextUrl.searchParams.get("due_only");

  let query = `
    SELECT s.*, p.name_model, p.imei, p.buy_price
    FROM sales s
    JOIN phones p ON p.id = s.phone_id
    WHERE 1=1
  `;
  const binds: string[] = [];

  if (from) {
    query += " AND date(s.selling_date) >= date(?)";
    binds.push(from);
  }
  if (to) {
    query += " AND date(s.selling_date) <= date(?)";
    binds.push(to);
  }
  if (dueOnly === "1") {
    query += " AND s.is_due = 1 AND s.due_amount > 0";
  }
  query += " ORDER BY s.selling_date DESC";

  const { results } = await db.prepare(query).bind(...binds).all();
  return NextResponse.json({ sales: results });
}

export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const {
    phone_id,
    selling_price,
    selling_date,
    is_due,
    customer_name,
    customer_phone,
    paid_now, // amount paid immediately, even if due
    ram_rom,
    battery_health,
  } = body;

  if (!phone_id || selling_price === undefined) {
    return NextResponse.json(
      { error: "ফোন এবং বিক্রয়মূল্য আবশ্যক" },
      { status: 400 }
    );
  }

  const phone = await db
    .prepare("SELECT * FROM phones WHERE id = ?")
    .bind(phone_id)
    .first<{ buy_price: number; status: string }>();

  if (!phone) {
    return NextResponse.json({ error: "ফোন পাওয়া যায়নি" }, { status: 404 });
  }
  if (phone.status === "sold") {
    return NextResponse.json(
      { error: "এই ফোনটি ইতিমধ্যে বিক্রি হয়ে গেছে" },
      { status: 409 }
    );
  }

  const profit = Number(selling_price) - Number(phone.buy_price);
  const dueFlag = is_due ? 1 : 0;
  const paidAmount = dueFlag ? Number(paid_now || 0) : Number(selling_price);
  const dueAmount = dueFlag ? Number(selling_price) - paidAmount : 0;

  const result = await db
    .prepare(
      `INSERT INTO sales
        (phone_id, selling_price, selling_date, profit, is_due, customer_name, customer_phone, due_amount, paid_amount, ram_rom, battery_health)
       VALUES (?, ?, COALESCE(?, datetime('now','localtime')), ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      phone_id,
      selling_price,
      selling_date || null,
      profit,
      dueFlag,
      customer_name || null,
      customer_phone || null,
      dueAmount,
      paidAmount,
      ram_rom || null,
      battery_health || null
    )
    .run();

  await db
    .prepare("UPDATE phones SET status = 'sold' WHERE id = ?")
    .bind(phone_id)
    .run();

  return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}
