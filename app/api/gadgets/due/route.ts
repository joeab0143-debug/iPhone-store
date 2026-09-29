import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// All outstanding gadget-sale dues, across every gadget -- mirrors
// GET /api/sales?due_only=1 for phones. Used by the dashboard's combined
// Due card so a customer's unpaid balance shows up whether they bought a
// phone or a gadget.
export async function GET() {
  const db = getDB();
  const { results } = await db
    .prepare(
      `SELECT gs.id, gs.gadget_id, g.buy_name, gs.sell_price, gs.customer_name, gs.customer_phone,
              gs.due_amount, gs.paid_amount, gs.sold_at
       FROM gadget_sales gs
       JOIN gadgets g ON g.id = gs.gadget_id
       WHERE gs.is_due = 1 AND gs.due_amount > 0
       ORDER BY gs.sold_at DESC`
    )
    .all();

  return NextResponse.json({ sales: results });
}
