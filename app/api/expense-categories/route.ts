import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function GET() {
  const db = getDB();
  const { results } = await db
    .prepare("SELECT * FROM expense_categories ORDER BY created_at ASC")
    .all();
  return NextResponse.json({ categories: results });
}

export async function POST(req: NextRequest) {
  const db = getDB();
  const body: any = await req.json();
  const { name, designation } = body;

  if (!name) {
    return NextResponse.json({ error: "নাম আবশ্যক" }, { status: 400 });
  }

  const result = await db
    .prepare("INSERT INTO expense_categories (name, designation) VALUES (?, ?)")
    .bind(name, designation || null)
    .run();

  return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
}
