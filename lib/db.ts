import { getRequestContext } from "@cloudflare/next-on-pages";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  // Weekly-backup storage (see lib/backup.ts, app/api/backup/*) -- optional
  // because a deployment that hasn't provisioned an R2 bucket yet should
  // keep working normally; every route that touches it checks for its
  // presence first and explains what's missing instead of crashing.
  BACKUPS?: R2Bucket;
  // Shared secret the weekly backup job calls /api/backup/run with, in
  // place of a login -- the caller is an outside scheduler (Cloudflare
  // Pages has no cron triggers of its own), not a signed-in admin.
  BACKUP_SECRET?: string;
}

export function getEnv(): Env {
  const ctx = getRequestContext();
  return ctx.env as unknown as Env;
}

export function getDB(): D1Database {
  return getEnv().DB;
}
