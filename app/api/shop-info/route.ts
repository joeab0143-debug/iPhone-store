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
  /** JSON-encoded string[] -- see parseNoticeLines(). */
  notice_lines: string | null;
}

const DEFAULT_SHOP_INFO: ShopInfoRow = {
  shop_name: "Apple Store Satkhira",
  address: null,
  phone: null,
  email: null,
  notice_lines: null,
};

function parseNoticeLines(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((l): l is string => typeof l === "string" && !!l.trim()) : [];
  } catch {
    return [];
  }
}

// GET is available to any logged-in session (middleware already gates
// login) -- both the invoice print flow and the admin-only Settings form
// read from here.
export async function GET() {
  const db = getDB();
  const row = await db
    .prepare("SELECT shop_name, address, phone, email, notice_lines FROM shop_info WHERE id = 1")
    .first<ShopInfoRow>();
  const r = row || DEFAULT_SHOP_INFO;
  return NextResponse.json({
    shop_name: r.shop_name,
    address: r.address,
    phone: r.phone,
    email: r.email,
    notice_lines: parseNoticeLines(r.notice_lines),
  });
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
  const noticeLines: string[] = Array.isArray(body.notice_lines)
    ? body.notice_lines.map((l: unknown) => String(l).trim()).filter((l: string) => !!l)
    : [];
  const noticeLinesJson = JSON.stringify(noticeLines);

  await db
    .prepare(
      `INSERT INTO shop_info (id, shop_name, address, phone, email, notice_lines)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         shop_name = excluded.shop_name,
         address = excluded.address,
         phone = excluded.phone,
         email = excluded.email,
         notice_lines = excluded.notice_lines,
         updated_at = datetime('now','localtime')`
    )
    .bind(shopName, address, phone, email, noticeLinesJson)
    .run();

  return NextResponse.json({ ok: true, shop_name: shopName, address, phone, email, notice_lines: noticeLines });
}
