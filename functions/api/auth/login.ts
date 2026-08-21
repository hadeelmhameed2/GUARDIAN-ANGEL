import {
  createToken,
  hashPassword,
  isLegacySha256Hash,
  verifyLegacySha256,
  verifyPassword,
} from "../../_lib/auth";
import { requireAuthEnv } from "../../_lib/env";
import { badRequest, json, methodNotAllowed, unauthorized } from "../../_lib/http";

type Env = {
  DB: D1Database;
  AUTH_SECRET: string;
  /** Legacy-only: verifies pre-PBKDF2 hashes so existing accounts aren't locked out. */
  PASSWORD_SALT?: string;
};

type LoginBody = {
  username?: string;
  password?: string;
};

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// Best-effort per-IP throttle. Cloudflare may route requests to a fresh
// isolate at any time, so this is defense-in-depth only — the per-account
// lockout tracked in D1 below is the durable control.
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
const IP_WINDOW_MS = 5 * 60 * 1000;
const IP_MAX_ATTEMPTS = 20;

function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > IP_MAX_ATTEMPTS;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const envError = requireAuthEnv(context.env);
  if (envError) return envError;

  const clientIp = context.request.headers.get("cf-connecting-ip") ?? "unknown";
  if (isIpRateLimited(clientIp)) {
    return json({ error: "Too many login attempts. Please try again later." }, 429);
  }

  let body: LoginBody;
  try {
    body = (await context.request.json()) as LoginBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const username = body.username?.trim();
  const password = body.password?.trim();

  if (!username || !password) {
    return badRequest("username and password are required");
  }

  try {
    const result = await context.env.DB.prepare(
      "SELECT id, username, password_hash, failed_attempts, locked_until FROM users WHERE username = ? LIMIT 1",
    )
      .bind(username)
      .first<UserRow>();

    if (!result) {
      return unauthorized("Invalid credentials");
    }

    if (result.locked_until && new Date(result.locked_until).getTime() > Date.now()) {
      return json({ error: "Account temporarily locked due to too many failed attempts. Try again later." }, 429);
    }

    let passwordOk: boolean;
    let needsRehash = false;

    if (isLegacySha256Hash(result.password_hash)) {
      passwordOk = context.env.PASSWORD_SALT?.trim()
        ? await verifyLegacySha256(password, context.env.PASSWORD_SALT, result.password_hash)
        : false;
      needsRehash = passwordOk;
    } else {
      passwordOk = await verifyPassword(password, result.password_hash);
    }

    if (!passwordOk) {
      const nextFailedAttempts = result.failed_attempts + 1;
      const lockedUntil =
        nextFailedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;
      await context.env.DB.prepare("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?")
        .bind(lockedUntil ? 0 : nextFailedAttempts, lockedUntil, result.id)
        .run();
      return unauthorized("Invalid credentials");
    }

    const updates: Promise<unknown>[] = [
      context.env.DB.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?")
        .bind(result.id)
        .run(),
    ];
    if (needsRehash) {
      const upgradedHash = await hashPassword(password);
      updates.push(
        context.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(upgradedHash, result.id).run(),
      );
    }
    await Promise.all(updates);

    const token = await createToken({ sub: result.id }, context.env.AUTH_SECRET);

    return json({ token, user: { id: result.id, username: result.username } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return json({ error: message }, 500);
  }
};

export const onRequest: PagesFunction = () => methodNotAllowed("POST");
