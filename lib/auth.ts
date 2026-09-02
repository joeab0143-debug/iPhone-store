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
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
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
