import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Powers the Buy sheet's supplier autocomplete -- a simple reusable list of
// past suppliers (name + phone/NID) so the owner doesn't have to retype a
// known supplier's contact details on every purchase. New suppliers are
// added automatically by applyPhoneBuy() (lib/approvalActions.ts) whenever
// a Buy completes with a name that isn't already on this list -- there's
// no separate "add supplier" flow to call here.
export async function GET() {
  const db = getDB();
  const { results } = await db
    .prepare("SELECT * FROM suppliers ORDER BY name COLLATE NOCASE ASC")
    .all();
  return NextResponse.json({ suppliers: results });
}
