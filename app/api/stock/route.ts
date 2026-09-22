import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { queueApproval } from "@/lib/approvals";
import { applyPhoneBuy } from "@/lib/approvalActions";

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

// Creating a new stock row happens two ways: (1) the Buy sheet's actual
// purchase flow -- a POS Manager's request here is queued for admin
// approval, same as any other Buy; (2) the Sell sheet's auto-create when a
// scanned/typed IMEI isn't in stock yet (buy price unknown, entered as 0)
// -- that's an inseparable step of completing a Sell, which a POS Manager
// can always do, so it's tagged `auto_create: true` and skips the approval
// gate entirely regardless of role.
export async function POST(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const body: any = await req.json();

  if (user.role === "pos_manager" && !body.auto_create) {
    if (!body.name_model || !body.imei || body.buy_price === undefined) {
      return NextResponse.json(
        { error: "Name/model, IMEI, and buy price are required" },
        { status: 400 }
      );
    }
    const id = await queueApproval(db, {
      actionType: "buy",
      resourceType: "phone",
      resourceLabel: `${body.name_model} (IMEI: ${body.imei})`,
      payload: body,
      requestedBy: user.username,
    });
    return NextResponse.json(
      { pending: true, approvalId: id, message: "Submitted for admin approval" },
      { status: 202 }
    );
  }

  const result = await applyPhoneBuy(db, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ id: result.data.id }, { status: 201 });
}
