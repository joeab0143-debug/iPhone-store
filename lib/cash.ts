import { getDB } from "@/lib/db";

// Shared by /api/dashboard and /api/cash-adjustment so both always agree on
// what "Total Cash" is built from. Everything here is all-time and never
// resets (unlike "Profit (So Far)", which is month-scoped).
//
// Total Cash = cashIn - cashOut + the manual adjustment (see
// getCashAdjustment/setCashAdjustment below and migrations/0013+).
export async function computeCashParts(): Promise<{
  cashIn: number;
  cashOut: number;
  totalBuyAmt: number;
}> {
  const db = getDB();
  const [salesPaidAllTime, totalBuy, expenseAllTime] =
    await Promise.all([
      db.prepare("SELECT COALESCE(SUM(paid_amount),0) AS total FROM sales").first<{ total: number }>(),
      // "Outside Stock" phones (migrations/0017) are bought without touching
      // Total Cash at all — only their regular-stock counterparts count here.
      db
        .prepare("SELECT COALESCE(SUM(buy_price),0) AS total FROM phones WHERE stock_type != 'outside'")
        .first<{ total: number }>(),
      db.prepare("SELECT COALESCE(SUM(amount),0) AS total FROM expenses").first<{ total: number }>(),
    ]);

  const totalBuyAmt = totalBuy?.total ?? 0;
  const cashIn = salesPaidAllTime?.total ?? 0;
  const cashOut = totalBuyAmt + (expenseAllTime?.total ?? 0);

  return { cashIn, cashOut, totalBuyAmt };
}

// The manual correction (see migrations/0013 onward) — 0 unless someone's
// explicitly fixed the starting cash balance from Settings. Table may not
// exist on an older DB that hasn't run that migration yet, hence the catch.
export async function getCashAdjustment(): Promise<number> {
  const db = getDB();
  const row = await db
    .prepare("SELECT amount FROM cash_adjustments WHERE id = 1")
    .first<{ amount: number }>()
    .catch(() => null);
  return row?.amount ?? 0;
}

export async function setCashAdjustment(amount: number): Promise<void> {
  const db = getDB();
  await db
    .prepare(
      `INSERT INTO cash_adjustments (id, amount, updated_at) VALUES (1, ?, datetime('now','localtime'))
       ON CONFLICT (id) DO UPDATE SET amount = excluded.amount, updated_at = datetime('now','localtime')`
    )
    .bind(amount)
    .run();
}
