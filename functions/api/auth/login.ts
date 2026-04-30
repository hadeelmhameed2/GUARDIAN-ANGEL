import { createToken, hashPassword } from "../../_lib/auth";
import { badRequest, json, methodNotAllowed, unauthorized } from "../../_lib/http";

type Env = {
  DB: D1Database;
  AUTH_SECRET: string;
  PASSWORD_SALT: string;
};

type LoginBody = {
  username?: string;
  password?: string;
};

type UserRow = {
  id: number;
  username: string;
  password_hash: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
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

  const result = await context.env.DB.prepare(
    "SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1"
  )
    .bind(username)
    .first<UserRow>();

  if (!result) {
    return unauthorized("Invalid credentials");
  }

  const incomingHash = await hashPassword(password, context.env.PASSWORD_SALT);
  if (incomingHash !== result.password_hash) {
    return unauthorized("Invalid credentials");
  }

  const token = await createToken(
    { userId: result.id, username: result.username, calculatorCode: password },
    context.env.AUTH_SECRET
  );

  return json({ token, user: { id: result.id, username: result.username } });
};

export const onRequest: PagesFunction = () => methodNotAllowed("POST");
