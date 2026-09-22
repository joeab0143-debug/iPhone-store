import { NextRequest, NextResponse } from "next/server";
import { computeCashParts, getCashAdjustment, setCashAdjustment } from "@/lib/cash";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// Settings → "Fix Total Cash" — lets the shop owner type in what Total
// Cash actually should be right now (matching their real cash-on-hand),
// without touching stock/sales/expense data at all. Under the hood this
// only ever changes the single manual-offset number in `cash_adjustments`
// (see migrations/0013+) — recomputed fresh every time so it's exact
// regardless of activity that happened between page loads.

export async function GET() {
  const [{ cashIn, cashOut }, adjustment] = await Promise.all([
    computeCashParts(),
    getCashAdjustment(),
  ]);
  return NextResponse.json({ current_total_cash: cashIn - cashOut + adjustment });
}

// Directly overrides the cash total, bypassing every record -- too
// sensitive to queue for approval, so it is simply not available to a POS
// Manager at all (admin-only), unlike Edit/Delete/Buy elsewhere in the app.
export async function PATCH(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body: any = await req.json().catch(() => ({}));
  const newTotalCash = Number(body.new_total_cash);

  if (body.new_total_cash === undefined || body.new_total_cash === null || Number.isNaN(newTotalCash)) {
    return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
  }

  // Recompute the live base (everything except the manual offset) right
  // now, so the new offset lands exactly on the requested total even if
  // something else changed cash in the meantime.
  const { cashIn, cashOut } = await computeCashParts();
  const base = cashIn - cashOut;
  const newAdjustment = newTotalCash - base;

  await setCashAdjustment(newAdjustment);

  return NextResponse.json({ ok: true, total_cash: base + newAdjustment });
}
