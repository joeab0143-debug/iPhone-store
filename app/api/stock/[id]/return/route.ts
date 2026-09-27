import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { queueApproval } from "@/lib/approvals";
import { applyPhoneReturn } from "@/lib/approvalActions";

export const runtime = "edge";

// Returns an unsold phone to whoever it was bought from (a Supplier, or an
// individual/"Used Phone" seller) -- removes it from stock the same way
// Delete does (so its buy cost drops back out of Total Cash/Buy on its
// own, see lib/cash.ts), but first snapshots it into `phone_returns` (see
// migrations/0028) so the shop owner can still see what was returned, to
// whom, and when -- unlike a plain delete, which leaves no trace.
//
// Only phones still in stock (unsold) can be returned this way -- a sold
// phone would need to come back from the customer first (the existing
// "Return" button on Sold phones handles that, and puts it back to
// unsold).
//
// A POS Manager's return doesn't apply here -- it's queued in
// pending_approvals instead, same as edit/delete/buy, and only takes
// effect once an admin approves it from the Approvals tab.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const user = await getSessionUser(db, req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const current = await db
    .prepare("SELECT name_model, imei, status, bought_from FROM phones WHERE id = ?")
    .bind(params.id)
    .first<{ name_model: string; imei: string; status: string; bought_from: string | null }>();
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (current.status !== "unsold") {
    return NextResponse.json(
      { error: "Only unsold phones can be returned to the supplier" },
      { status: 400 }
    );
  }

  if (user.role === "pos_manager") {
    const id = await queueApproval(db, {
      actionType: "return",
      resourceType: "phone",
      resourceId: params.id,
      resourceLabel: current.bought_from
        ? `${current.name_model} (IMEI: ${current.imei}) — ${current.bought_from}`
        : `${current.name_model} (IMEI: ${current.imei})`,
      requestedBy: user.username,
    });
    return NextResponse.json(
      { pending: true, approvalId: id, message: "Submitted for admin approval" },
      { status: 202 }
    );
  }

  const result = await applyPhoneReturn(db, params.id, user.username);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
