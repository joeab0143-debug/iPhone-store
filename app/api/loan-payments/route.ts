import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// Record a partial (or final) repayment against a loan — either direction
// (taken or given), same idea as /api/due-payments for phone-sale dues.
export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const { loan_id, amount, note, paid_date } = body;

  if (!loan_id || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: "বৈধ পরিমাণ দিন" }, { status: 400 });
  }

  const loan = await db
    .prepare("SELECT amount, paid_amount FROM loans WHERE id = ?")
    .bind(loan_id)
    .first<{ amount: number; paid_amount: number }>();

  if (!loan) {
    return NextResponse.json({ error: "ধারের এন্ট্রি পাওয়া যায়নি" }, { status: 404 });
  }

  const remaining = Number(loan.amount) - Number(loan.paid_amount);
  if (Number(amount) > remaining) {
    return NextResponse.json(
      { error: "বাকি থাকা পরিমাণের চেয়ে বেশি দেওয়া যাবে না" },
      { status: 400 }
    );
  }

  await db
    .prepare(
      `INSERT INTO loan_payments (loan_id, amount, paid_date, note)
       VALUES (?, ?, COALESCE(?, datetime('now','localtime')), ?)`
    )
    .bind(loan_id, amount, paid_date || null, note || null)
    .run();

  const newPaid = Number(loan.paid_amount) + Number(amount);
  const fullySettled = newPaid >= Number(loan.amount);

  if (fullySettled) {
    await db
      .prepare(
        `UPDATE loans SET paid_amount = ?, status = 'settled', settled_date = datetime('now','localtime') WHERE id = ?`
      )
      .bind(newPaid, loan_id)
      .run();
  } else {
    await db
      .prepare(`UPDATE loans SET paid_amount = ? WHERE id = ?`)
      .bind(newPaid, loan_id)
      .run();
  }

  return NextResponse.json({
    ok: true,
    paid_amount: newPaid,
    remaining: Number(loan.amount) - newPaid,
    status: fullySettled ? "settled" : "pending",
  });
}
