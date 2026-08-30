import { getRequestContext } from "@cloudflare/next-on-pages";
import type { D1Database } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
}

export function getDB(): D1Database {
  const ctx = getRequestContext();
  return (ctx.env as unknown as Env).DB;
}
