export type SessionPayload = {
  sub: number;
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function toBase64Url(input: string): string {
  return bytesToBase64(encoder.encode(input)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const padded = input + "=".repeat((4 - (input.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Constant-time string compare — avoids leaking match-length via early-exit timing. */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

async function signHmacSha256(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bytesToBase64(new Uint8Array(signature)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Token payload only ever carries the user id + timestamps — never a
 * credential. JWTs are signed, not encrypted, so anything sensitive placed
 * here is readable by anyone who obtains the token.
 */
export async function createToken(
  payload: { sub: number },
  secret: string,
  expiresInSeconds = 60 * 60 * 24
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    sub: payload.sub,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(fullPayload));
  const data = `${header}.${body}`;
  const signature = await signHmacSha256(data, secret);
  return `${data}.${signature}`;
}

export async function verifyToken(token: string, secret: string): Promise<SessionPayload | null> {
  const normalized = token.trim().replace(/^Bearer\s+/i, "");
  const parts = normalized.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const data = `${header}.${payload}`;
  const expectedSignature = await signHmacSha256(data, secret);
  if (!timingSafeEqualStr(signature, expectedSignature)) return null;

  let parsed: SessionPayload;
  try {
    parsed = JSON.parse(fromBase64Url(payload)) as SessionPayload;
  } catch {
    return null;
  }

  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  if (typeof parsed.sub !== "number" || !Number.isFinite(parsed.sub)) return null;
  return parsed;
}

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = "SHA-256";
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_KEY_LENGTH_BITS = 256;
const PBKDF2_PREFIX = "pbkdf2";

async function pbkdf2DeriveBase64(password: string, saltBytes: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, [
    "deriveBits",
  ]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes as BufferSource, iterations, hash: PBKDF2_DIGEST },
    keyMaterial,
    PBKDF2_KEY_LENGTH_BITS
  );
  return bytesToBase64(new Uint8Array(derivedBits));
}

/**
 * Hashes a password/PIN with PBKDF2 using a fresh random salt per call.
 * The result is self-describing (`pbkdf2$<iterations>$<saltB64>$<hashB64>`)
 * so no separate salt column or global secret is required to verify it later.
 */
export async function hashPassword(
  password: string,
  iterations = PBKDF2_ITERATIONS
): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const hashB64 = await pbkdf2DeriveBase64(password, saltBytes, iterations);
  return `${PBKDF2_PREFIX}$${iterations}$${bytesToBase64(saltBytes)}$${hashB64}`;
}

function isPbkdf2Hash(stored: string): boolean {
  return stored.startsWith(`${PBKDF2_PREFIX}$`);
}

/** True for the retired `sha256(salt:password)` format this replaces. */
export function isLegacySha256Hash(stored: string): boolean {
  return /^[0-9a-f]{64}$/i.test(stored);
}

export async function verifyLegacySha256(password: string, salt: string, storedHash: string): Promise<boolean> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(`${salt}:${password}`));
  const computed = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return timingSafeEqualStr(computed, storedHash);
}

/** Verifies a password/PIN against a `pbkdf2$...` hash produced by {@link hashPassword}. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!isPbkdf2Hash(stored)) return false;
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const saltBytes = base64ToBytes(parts[2]);
  const expectedHash = parts[3];
  const actualHash = await pbkdf2DeriveBase64(password, saltBytes, iterations);
  return timingSafeEqualStr(actualHash, expectedHash);
}
