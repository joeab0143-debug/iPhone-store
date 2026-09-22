import { NextRequest, NextResponse } from "next/server";
import { computeCashParts, getCashAdjustment, setCashAdjustment } from "@/lib/cash";

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

export async function PATCH(req: NextRequest) {
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
