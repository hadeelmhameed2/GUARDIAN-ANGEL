import { createToken, hashPassword } from "../../_lib/auth";
import { badRequest, json, methodNotAllowed } from "../../_lib/http";

type Env = {
  DB: D1Database;
  AUTH_SECRET: string;
  PASSWORD_SALT: string;
};

type RegisterBody = {
  username?: string;
  password?: string;
};

type ExistingUser = {
  id: number;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: RegisterBody;
  try {
    body = (await context.request.json()) as RegisterBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const username = body.username?.trim();
  const password = body.password?.trim();

  if (!username || !password) {
    return badRequest("username and password are required");
  }

  if (username.length < 3) {
    return badRequest("username must be at least 3 characters");
  }

  if (password.length < 4) {
    return badRequest("password must be at least 4 characters");
  }

  const existing = await context.env.DB.prepare("SELECT id FROM users WHERE username = ? LIMIT 1")
    .bind(username)
    .first<ExistingUser>();

  if (existing) {
    return badRequest("username already exists");
  }

  const passwordHash = await hashPassword(password, context.env.PASSWORD_SALT);
  const insert = await context.env.DB.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .bind(username, passwordHash)
    .run();

  const userId = Number(insert.meta.last_row_id ?? 0);
  const token = await createToken({ userId, username, calculatorCode: password }, context.env.AUTH_SECRET);

  return json({ token, user: { id: userId, username } }, 201);
};

export const onRequest: PagesFunction = () => methodNotAllowed("POST");
