export type SessionPayload = {
  userId: number;
  username: string;
  calculatorCode: string;
  exp: number;
};

const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
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

export async function createToken(
  payload: Omit<SessionPayload, "exp">,
  secret: string,
  expiresInSeconds = 60 * 60 * 24
): Promise<string> {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
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
  if (signature !== expectedSignature) return null;

  let parsed: SessionPayload;
  try {
    parsed = JSON.parse(fromBase64Url(payload)) as SessionPayload;
  } catch {
    return null;
  }

  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  if (parsed.userId == null || !parsed.username || !parsed.calculatorCode) return null;
  return parsed;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const msgUint8 = encoder.encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
