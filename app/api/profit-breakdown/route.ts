import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

// "এই মাসের প্রফিট" ড্যাশবোর্ড ট্যাইলে ক্লিক করলে যে ব্রেকডাউন দেখানো হয় —
// কোন কোন খাতে (স্টক প্রফিট, Outside প্রফিট, প্রতিটা খরচের ঘর/খাত) কত টাকা
// যোগ/বিয়োগ হয়ে চলতি মাসের প্রফিট তৈরি হলো। শুধু চলতি ক্যালেন্ডার মাসের
// হিসাব — /api/dashboard-এর profit_till_now-এর সাথে একই মাস-স্কোপ ব্যবহার
// করা হচ্ছে (strftime('%Y-%m', ...) = বর্তমান মাস), তাই দুটো সংখ্যা সবসময়
// মিলবে। একই নামের একাধিক খরচের ঘর (category) থাকলেও নামের ভিত্তিতে
// GROUP BY করায় সেগুলো একত্রে একটা লাইনেই দেখাবে।
export async function GET() {
  const db = getDB();

  const [stockProfitRow, outsideProfitRow, expenseRows] = await Promise.all([
    db
      .prepare(
        "SELECT COALESCE(SUM(profit),0) AS total FROM sales WHERE strftime('%Y-%m', selling_date) = strftime('%Y-%m','now','localtime')"
      )
      .first<{ total: number }>(),
    db
      .prepare(
        "SELECT COALESCE(SUM(profit),0) AS total FROM outside_deals WHERE status = 'sold' AND strftime('%Y-%m', sell_date) = strftime('%Y-%m','now','localtime')"
      )
      .first<{ total: number }>(),
    db
      .prepare(
        `SELECT c.name AS category_name, COALESCE(SUM(e.amount),0) AS total
         FROM expenses e
         JOIN expense_categories c ON c.id = e.category_id
         WHERE strftime('%Y-%m', e.expense_date) = strftime('%Y-%m','now','localtime')
         GROUP BY c.name
         ORDER BY total DESC`
      )
      .all<{ category_name: string; total: number }>(),
  ]);

  const stockProfit = stockProfitRow?.total ?? 0;
  const outsideProfit = outsideProfitRow?.total ?? 0;
  const expenseCategories = (expenseRows?.results ?? []).map((r) => ({
    name: r.category_name,
    total: r.total,
  }));
  const totalExpense = expenseCategories.reduce((s, c) => s + c.total, 0);
  const netProfit = stockProfit + outsideProfit - totalExpense;

  return NextResponse.json({
    stock_profit: stockProfit,
    outside_profit: outsideProfit,
    expense_categories: expenseCategories,
    total_expense: totalExpense,
    net_profit: netProfit,
  });
}
