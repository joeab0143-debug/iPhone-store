import type { D1Database } from "@cloudflare/workers-types";

// The actual DB mutations behind every action a POS Manager needs
// admin approval for. Each route's own handler calls these directly when
// the caller is an admin (applies immediately); the approve route
// (app/api/pending-approvals/[id]/approve) calls the same functions,
// through applyPendingApproval() below, once an admin approves a queued
// POS Manager request. Keeping the logic here (instead of duplicated
// inline in both places) means the two paths can never drift apart.

export type ApplyResult =
  | { ok: true; data?: any }
  | { ok: false; error: string; status: number };

// --- Stock (phones) -------------------------------------------------------

export async function applyPhoneBuy(db: D1Database, payload: any): Promise<ApplyResult> {
  const {
    name_model,
    imei,
    buy_price,
    buy_date,
    ram_rom,
    battery_health,
    bought_from,
    phone_number,
    nid,
    seller_type,
    nid_front_photo,
    nid_back_photo,
    person_photo,
  } = payload || {};

  if (!name_model || !imei || buy_price === undefined) {
    return { ok: false, error: "Name/model, IMEI, and buy price are required", status: 400 };
  }

  const sellerType = seller_type === "individual" ? "individual" : "supplier";

  try {
    const result = await db
      .prepare(
        `INSERT INTO phones (name_model, imei, buy_price, buy_date, status, ram_rom, battery_health, bought_from, phone_number, nid, seller_type, nid_front_photo, nid_back_photo, person_photo)
         VALUES (?, ?, ?, COALESCE(?, datetime('now','localtime')), 'unsold', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        name_model,
        imei,
        buy_price,
        buy_date || null,
        ram_rom || null,
        battery_health || null,
        bought_from || null,
        phone_number || null,
        nid || null,
        sellerType,
        sellerType === "individual" ? nid_front_photo || null : null,
        sellerType === "individual" ? nid_back_photo || null : null,
        sellerType === "individual" ? person_photo || null : null
      )
      .run();
    return { ok: true, data: { id: result.meta.last_row_id } };
  } catch (e: any) {
    if (String(e.message || e).includes("UNIQUE")) {
      return { ok: false, error: "A phone with this IMEI is already in stock (Unsold)", status: 409 };
    }
    return { ok: false, error: "Could not save", status: 500 };
  }
}

export async function applyPhoneEdit(db: D1Database, id: number | string, payload: any): Promise<ApplyResult> {
  const {
    name_model,
    imei,
    buy_price,
    buy_date,
    ram_rom,
    battery_health,
    bought_from,
    phone_number,
    nid,
  } = payload || {};

  try {
    await db
      .prepare(
        `UPDATE phones SET
          name_model = COALESCE(?, name_model),
          imei = COALESCE(?, imei),
          buy_price = COALESCE(?, buy_price),
          buy_date = COALESCE(?, buy_date),
          ram_rom = COALESCE(?, ram_rom),
          battery_health = COALESCE(?, battery_health),
          bought_from = COALESCE(?, bought_from),
          phone_number = COALESCE(?, phone_number),
          nid = COALESCE(?, nid)
         WHERE id = ?`
      )
      .bind(
        name_model ?? null,
        imei ?? null,
        buy_price ?? null,
        buy_date ?? null,
        ram_rom ?? null,
        battery_health ?? null,
        bought_from ?? null,
        phone_number ?? null,
        nid ?? null,
        id
      )
      .run();
    return { ok: true };
  } catch (e: any) {
    if (String(e.message || e).includes("UNIQUE")) {
      return { ok: false, error: "Another phone with this IMEI is already in stock (Unsold)", status: 409 };
    }
    return { ok: false, error: "Could not save", status: 500 };
  }
}

export async function applyPhoneDelete(db: D1Database, id: number | string): Promise<ApplyResult> {
  await db.prepare("DELETE FROM phones WHERE id = ?").bind(id).run();
  return { ok: true };
}

// --- Sales -----------------------------------------------------------------

export async function applySaleDelete(db: D1Database, id: number | string): Promise<ApplyResult> {
  const sale = await db
    .prepare("SELECT phone_id FROM sales WHERE id = ?")
    .bind(id)
    .first<{ phone_id: number }>();
  if (!sale) {
    return { ok: false, error: "Not found", status: 404 };
  }
  await db.prepare("DELETE FROM sales WHERE id = ?").bind(id).run();
  await db.prepare("UPDATE phones SET status = 'unsold' WHERE id = ?").bind(sale.phone_id).run();
  return { ok: true };
}

// --- Expense categories / expenses -----------------------------------------

export async function applyExpenseCategoryEdit(db: D1Database, id: number | string, payload: any): Promise<ApplyResult> {
  const { name, designation } = payload || {};
  await db
    .prepare(
      "UPDATE expense_categories SET name = COALESCE(?, name), designation = COALESCE(?, designation) WHERE id = ?"
    )
    .bind(name ?? null, designation ?? null, id)
    .run();
  return { ok: true };
}

export async function applyExpenseCategoryDelete(db: D1Database, id: number | string): Promise<ApplyResult> {
  await db.prepare("DELETE FROM expense_categories WHERE id = ?").bind(id).run();
  return { ok: true };
}

export async function applyExpenseDelete(db: D1Database, id: number | string): Promise<ApplyResult> {
  await db.prepare("DELETE FROM expenses WHERE id = ?").bind(id).run();
  return { ok: true };
}

// --- Gadgets -----------------------------------------------------------------

export async function applyGadgetDelete(db: D1Database, id: number | string): Promise<ApplyResult> {
  await db.prepare("DELETE FROM gadget_sales WHERE gadget_id = ?").bind(id).run();
  await db.prepare("DELETE FROM gadgets WHERE id = ?").bind(id).run();
  return { ok: true };
}

// --- Dispatcher used by the approve route -----------------------------------
//
// Keep this switch in sync with lib/approvals.ts's ApprovalResourceType --
// every resource_type ever queued must have a matching case here.

export async function applyPendingApproval(
  db: D1Database,
  row: { action_type: string; resource_type: string; resource_id: number | null; payload: string | null }
): Promise<ApplyResult> {
  const payload = row.payload ? JSON.parse(row.payload) : null;
  const key = `${row.resource_type}:${row.action_type}`;

  switch (key) {
    case "phone:buy":
      return applyPhoneBuy(db, payload);
    case "phone:edit":
      return applyPhoneEdit(db, row.resource_id as number, payload);
    case "phone:delete":
      return applyPhoneDelete(db, row.resource_id as number);
    case "sale:delete":
      return applySaleDelete(db, row.resource_id as number);
    case "expense_category:edit":
      return applyExpenseCategoryEdit(db, row.resource_id as number, payload);
    case "expense_category:delete":
      return applyExpenseCategoryDelete(db, row.resource_id as number);
    case "expense:delete":
      return applyExpenseDelete(db, row.resource_id as number);
    case "gadget:delete":
      return applyGadgetDelete(db, row.resource_id as number);
    default:
      return { ok: false, error: `Unknown approval type: ${key}`, status: 500 };
  }
}
