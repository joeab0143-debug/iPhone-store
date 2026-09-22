// Password hashing (PBKDF2-SHA256 via Web Crypto) for the app's single
// admin login. Web Crypto is used instead of Node's `crypto` module so this
// works identically in Edge Runtime API routes AND in middleware.ts (which
// cannot use Node's crypto even with nodejs_compat).

const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256; // 32 bytes

function bytesToHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  // Cast salt to BufferSource: newer @types/node / TS DOM lib versions make
  // Uint8Array generic over its backing buffer (Uint8Array<ArrayBufferLike>),
  // which no longer structurally matches BufferSource (which wants
  // ArrayBufferView<ArrayBuffer> specifically) without an explicit cast —
  // this is purely a type-level mismatch, not a runtime one.
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return bytesToHex(bits);
}

export async function hashPassword(
  password: string
): Promise<{ hash: string; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, saltBytes);
  return { hash, salt: bytesToHex(saltBytes) };
}

export async function verifyPassword(
  password: string,
  saltHex: string,
  hashHex: string
): Promise<boolean> {
  const computed = await pbkdf2(password, hexToBytes(saltHex));
  return timingSafeEqual(computed, hashHex);
}

// Plain string comparison leaks timing information about how many leading
// characters match, which could theoretically help an attacker brute-force
// a hash byte by byte. Compare every character regardless of an early
// mismatch.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function newSessionToken(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

export const SESSION_COOKIE = "pf_session";
export const SESSION_DAYS = 30;

// --- Roles: admin (the single app_credentials row, always present) and an
// optional POS Manager (pos_manager_credentials, zero-or-one row, created
// from Settings). A session's `role` column (see migration 0019) says which
// account logged in, so every route can branch without a second lookup.

export type UserRole = "admin" | "pos_manager";

export interface SessionUser {
  role: UserRole;
  username: string;
}

// Resolves the logged-in user (role + username) for the current session
// token, or null if there's no valid session. Every route that needs to
// know who's calling -- to gate a mutation, or to show "who's logged in" --
// should go through this instead of re-querying app_sessions by hand.
export async function getSessionUser(
  db: import("@cloudflare/workers-types").D1Database,
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;

  const session = await db
    .prepare(
      "SELECT role FROM app_sessions WHERE token = ? AND expires_at > datetime('now','localtime')"
    )
    .bind(token)
    .first<{ role: string }>();
  if (!session) return null;

  const role: UserRole = session.role === "pos_manager" ? "pos_manager" : "admin";

  if (role === "pos_manager") {
    const cred = await db
      .prepare("SELECT username FROM pos_manager_credentials WHERE id = 1")
      .first<{ username: string }>();
    return { role, username: cred?.username || "pos_manager" };
  }

  const cred = await db
    .prepare("SELECT username FROM app_credentials WHERE id = 1")
    .first<{ username: string }>();
  return { role, username: cred?.username || "admin" };
}
