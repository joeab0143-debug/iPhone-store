import { NextRequest, NextResponse } from "next/server";
import { getDB, getEnv } from "@/lib/db";
import { buildBackupPayload, backupFilename } from "@/lib/backup";

export const runtime = "edge";

// The automatic weekly backup. Cloudflare Pages has no cron triggers of
// its own (only plain Workers do), so this is meant to be called by an
// outside scheduler -- a free weekly cron service, or a small scheduled
// GitHub Action -- hitting this URL with the shared secret, not something
// anyone browsing the app ever touches directly. See the project doc for
// exact setup steps (R2 bucket + BACKUP_SECRET + registering the cron).
//
// Every call: builds a fresh export, uploads it to the BACKUPS R2 bucket,
// then keeps only the most recent KEEP copies so storage doesn't grow
// forever (12 weekly copies ~= 3 months of history).
const KEEP = 12;

async function handle(req: NextRequest) {
  const env = getEnv();
  const configured = env.BACKUP_SECRET;
  if (!configured) {
    return NextResponse.json(
      { error: "BACKUP_SECRET is not configured for this deployment" },
      { status: 500 }
    );
  }
  const provided = req.nextUrl.searchParams.get("secret") || req.headers.get("x-backup-secret");
  if (provided !== configured) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!env.BACKUPS) {
    return NextResponse.json(
      { error: "No BACKUPS R2 bucket is bound to this deployment" },
      { status: 500 }
    );
  }

  const db = getDB();
  const payload = await buildBackupPayload(db);
  const key = `backups/${backupFilename()}`;
  await env.BACKUPS.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: "application/json" },
  });

  const listed = await env.BACKUPS.list({ prefix: "backups/" });
  const newestFirst = listed.objects
    .slice()
    .sort((a, b) => (a.uploaded < b.uploaded ? 1 : -1));
  const stale = newestFirst.slice(KEEP);
  for (const obj of stale) {
    await env.BACKUPS.delete(obj.key);
  }

  return NextResponse.json({ ok: true, key, kept: Math.min(newestFirst.length, KEEP) });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
