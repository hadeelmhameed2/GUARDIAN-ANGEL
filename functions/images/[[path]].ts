import { getBearerToken, verifyToken } from "../_lib/auth";

type Env = {
  JOURNAL_IMAGES: R2Bucket;
  AUTH_SECRET: string;
};

function unauthorizedResponse(message: string, status: 401 | 403): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const key = context.params.path;
  if (!key || Array.isArray(key)) {
    return new Response("Not Found", { status: 404 });
  }

  if (!context.env.AUTH_SECRET?.trim()) {
    return unauthorizedResponse("AUTH_SECRET is not configured", 403);
  }

  const token = getBearerToken(context.request);
  if (!token) return unauthorizedResponse("Missing Bearer token", 401);

  const session = await verifyToken(token, context.env.AUTH_SECRET);
  if (!session) return unauthorizedResponse("Invalid or expired token", 401);

  // Keys are always `journal/{userId}/...` (see functions/api/images/upload.ts) —
  // only the owning user may fetch their own evidence images.
  const [namespace, ownerId] = key.split("/");
  if (namespace !== "journal" || ownerId !== String(session.sub)) {
    return unauthorizedResponse("Forbidden", 403);
  }

  const object = await context.env.JOURNAL_IMAGES.get(key);
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, no-store, no-cache, must-revalidate");

  return new Response(object.body, { headers });
};
