import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "edge";

// The read side of the "Return to Supplier" history (see
// migrations/0028_phone_returns.sql and POST /api/stock/[id]/return) --
// powers the "Return History" popup in Stock. Newest first; any logged-in
// session can view it (same as GET /api/stock), it's just a look at past
// records, nothing gated here.
export async function GET(req: NextRequest) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { results } = await db
    .prepare("SELECT * FROM phone_returns ORDER BY id DESC LIMIT 200")
    .all();

  return NextResponse.json({ returns: results || [] });
}
