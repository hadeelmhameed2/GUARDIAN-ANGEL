import { json } from "./http";
import { withCors } from "./cors";

type AuthEnv = {
  DB?: D1Database;
  AUTH_SECRET?: string;
  /** Legacy-only: the old global salt, kept solely to verify not-yet-migrated sha256 hashes. */
  PASSWORD_SALT?: string;
};

export function requireAuthEnv(env: AuthEnv): Response | null {
  if (!env.DB) {
    return withCors(json({ error: "Database binding (DB) is not configured" }, 503));
  }
  if (!env.AUTH_SECRET?.trim()) {
    return withCors(json({ error: "AUTH_SECRET is not configured" }, 503));
  }
  return null;
}

export function requireJwtEnv(env: { AUTH_SECRET?: string }): Response | null {
  if (!env.AUTH_SECRET?.trim()) {
    return withCors(json({ error: "AUTH_SECRET is not configured" }, 503));
  }
  return null;
}

type VisionEnv = {
  OPENAI_API_KEY?: string;
  AI?: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<{ response?: string }>;
  };
};

export function requireVisionEnv(env: VisionEnv): Response | null {
  if (env.OPENAI_API_KEY?.trim()) {
    return null;
  }
  if (env.AI?.run) {
    return null;
  }
  return withCors(
    json(
      {
        error:
          "Vision provider is not configured (bind Workers AI as AI or set OPENAI_API_KEY)",
      },
      503,
    ),
  );
}
