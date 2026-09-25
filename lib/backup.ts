import type { D1Database } from "@cloudflare/workers-types";

// Shared "export everything" logic used by both the admin's on-demand
// "Download Full Backup Now" button (app/api/backup/full) and the
// automatic weekly copy (app/api/backup/run). Business data only --
// app_credentials, app_sessions and pos_manager_credentials are
// deliberately left out: they hold password hashes and session tokens,
// which don't belong in a portable data backup and would be a real
// security liability if the file were ever lost, emailed, or opened on
// someone else's computer. If a table is added later and should be part
// of the shop's data backup, add its name below.
const BACKUP_TABLES = [
  "phones",
  "sales",
  "due_payments",
  "expense_categories",
  "expenses",
  "gadgets",
  "gadget_sales",
  "cash_adjustments",
  "suppliers",
  "shop_info",
] as const;

export interface BackupPayload {
  generated_at: string;
  app: "iphone-store";
  version: 1;
  tables: Record<string, unknown[]>;
}

export async function buildBackupPayload(db: D1Database): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {};
  for (const name of BACKUP_TABLES) {
    // Table names come from the fixed list above, never from user input,
    // so interpolating them directly is safe.
    const { results } = await db.prepare(`SELECT * FROM ${name}`).all();
    tables[name] = results || [];
  }
  return {
    generated_at: new Date().toISOString(),
    app: "iphone-store",
    version: 1,
    tables,
  };
}

export function backupFilename(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `iphone-store-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}.json`;
}
