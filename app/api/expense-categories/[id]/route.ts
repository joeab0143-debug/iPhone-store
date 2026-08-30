import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

export const runtime = "edge";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  const { name, designation }: any = await req.json();
  await db
    .prepare(
      "UPDATE expense_categories SET name = COALESCE(?, name), designation = COALESCE(?, designation) WHERE id = ?"
    )
    .bind(name ?? null, designation ?? null, params.id)
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDB();
  await db.prepare("DELETE FROM expense_categories WHERE id = ?").bind(params.id).run();
  return NextResponse.json({ ok: true });
}
