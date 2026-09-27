import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";

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
  // Added alongside the "Restore from Backup" feature -- return history
  // (see migrations/0028_phone_returns.sql) is business data too, so it
  // round-trips through a backup/restore just like everything else above.
  "phone_returns",
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

// --- Restore -----------------------------------------------------------
//
// The admin's "Restore from Backup" upload in Settings (see
// app/api/backup/restore) replaces every table below with whatever rows
// are in the uploaded backup file -- a full point-in-time rollback, not a
// merge. Kept as a fixed, hardcoded list (never derived from the
// uploaded file) so a restore can only ever touch these tables, never
// app_credentials/app_sessions/pos_manager_credentials (logins keep
// working through a restore, same as through the Phase 26 full reset) or
// pending_approvals (transient request state, not a "data" table).
//
// Order is child-before-parent (mirrors
// migrations/0027_reset_all_business_data.sql) so the DELETE step is safe
// regardless of whether SQLite foreign-key enforcement happens to be on
// for this connection. shop_info and cash_adjustments are singleton
// tables (id INTEGER PRIMARY KEY CHECK (id = 1)) and go last.
const RESTORE_TABLES = [
  "due_payments",
  "sales",
  "phone_returns",
  "phones",
  "gadget_sales",
  "gadgets",
  "expenses",
  "expense_categories",
  "suppliers",
  "cash_adjustments",
  "shop_info",
] as const;

// Tables declared with SQLite's AUTOINCREMENT keyword -- these need their
// sqlite_sequence counter re-synced after a restore inserts rows with
// explicit (restored) ids, so the next new row created after a restore
// doesn't collide with one that was just restored. shop_info and
// cash_adjustments are excluded -- they're singleton tables with no
// AUTOINCREMENT.
const AUTOINCREMENT_TABLES = new Set<string>([
  "due_payments",
  "sales",
  "phone_returns",
  "phones",
  "gadget_sales",
  "gadgets",
  "expenses",
  "expense_categories",
  "suppliers",
]);

async function tableColumns(db: D1Database, table: string): Promise<string[]> {
  const { results } = await db
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string }>();
  return (results || []).map((r) => r.name);
}

// D1 batches are capped in size, so a large table's DELETE + many INSERTs
// is sent in chunks rather than as one call. Each chunk is still one
// atomic batch, just not the whole table in a single round trip.
const BATCH_CHUNK = 150;

async function runChunked(db: D1Database, statements: D1PreparedStatement[]) {
  for (let i = 0; i < statements.length; i += BATCH_CHUNK) {
    await db.batch(statements.slice(i, i + BATCH_CHUNK));
  }
}

// Replaces every table in RESTORE_TABLES with the rows from a previously
// downloaded backup file's `tables` object (see buildBackupPayload
// above). For each table: delete everything currently in it, then
// re-insert every row from the backup using only the columns that exist
// in *both* the live schema and that row -- so an older backup that
// predates a since-added column (e.g. box_status, added in migration
// 0029) just restores that column back to its schema default/NULL
// instead of failing, and a since-removed column left over in an old
// backup is silently ignored. Original ids are preserved so
// relationships between tables (sales.phone_id, due_payments.sale_id,
// gadget_sales.gadget_id) stay intact.
export async function restoreFromBackup(
  db: D1Database,
  tables: Record<string, unknown[]>
): Promise<Record<string, number>> {
  const restored: Record<string, number> = {};

  for (const table of RESTORE_TABLES) {
    const rows = Array.isArray(tables[table])
      ? (tables[table] as Record<string, unknown>[])
      : [];
    const columns = await tableColumns(db, table);
    const statements: D1PreparedStatement[] = [db.prepare(`DELETE FROM ${table}`)];

    for (const row of rows) {
      const cols = columns.filter((c) => Object.prototype.hasOwnProperty.call(row, c));
      if (cols.length === 0) continue;
      const placeholders = cols.map(() => "?").join(", ");
      statements.push(
        db
          .prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`)
          .bind(...cols.map((c) => row[c]))
      );
    }

    if (AUTOINCREMENT_TABLES.has(table)) {
      statements.push(db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).bind(table));
      statements.push(
        db
          .prepare(
            `INSERT INTO sqlite_sequence (name, seq) SELECT ?, COALESCE(MAX(id), 0) FROM ${table}`
          )
          .bind(table)
      );
    }

    await runChunked(db, statements);
    restored[table] = rows.length;
  }

  return restored;
}
