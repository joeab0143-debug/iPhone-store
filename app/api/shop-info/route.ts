import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// Shop identity (name/address/phone/email) shown on the printed Sales
// Invoice memo -- see lib/sales-invoice.ts. Singleton row (id=1), same
// pattern as app_credentials/pos_manager_credentials.

interface ShopInfoRow {
  shop_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

const DEFAULT_SHOP_INFO: ShopInfoRow = {
  shop_name: "Apple Store Satkhira",
  address: null,
  phone: null,
  email: null,
};

// GET is available to any logged-in session (middleware already gates
// login) -- both the invoice print flow and the admin-only Settings form
// read from here.
export async function GET() {
  const db = getDB();
  const row = await db
    .prepare("SELECT shop_name, address, phone, email FROM shop_info WHERE id = 1")
    .first<ShopInfoRow>();
  return NextResponse.json(row || DEFAULT_SHOP_INFO);
}

// Only the admin can change the shop's own identity.
export async function PATCH(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body: any = await req.json().catch(() => ({}));
  const shopName = String(body.shop_name || "").trim() || "Apple Store Satkhira";
  const address = body.address ? String(body.address).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;
  const email = body.email ? String(body.email).trim() : null;

  await db
    .prepare(
      `INSERT INTO shop_info (id, shop_name, address, phone, email)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         shop_name = excluded.shop_name,
         address = excluded.address,
         phone = excluded.phone,
         email = excluded.email,
         updated_at = datetime('now','localtime')`
    )
    .bind(shopName, address, phone, email)
    .run();

  return NextResponse.json({ ok: true, shop_name: shopName, address, phone, email });
}
