import { verifyToken } from "../../_lib/auth";
import { badRequest, json, methodNotAllowed, unauthorized } from "../../_lib/http";

type Env = {
  JOURNAL_IMAGES: R2Bucket;
  AUTH_SECRET: string;
};

type UploadBody = {
  imageBase64?: string;
  contentType?: string;
  fileName?: string;
};

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [type, token] = authHeader.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const token = getBearerToken(context.request);
  if (!token) return unauthorized("Missing Bearer token");

  const session = await verifyToken(token, context.env.AUTH_SECRET);
  if (!session) return unauthorized("Invalid token");

  let body: UploadBody;
  try {
    body = (await context.request.json()) as UploadBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const imageBase64 = body.imageBase64;
  const contentType = body.contentType || "image/jpeg";
  const extension = contentType.split("/")[1] || "jpg";

  if (!imageBase64) {
    return badRequest("imageBase64 is required");
  }

  const bytes = base64ToUint8Array(imageBase64);
  const now = Date.now();
  const key = body.fileName?.trim() || `journal/${session.userId}/${now}.${extension}`;

  await context.env.JOURNAL_IMAGES.put(key, bytes, {
    httpMetadata: { contentType },
  });

  const publicUrl = new URL(context.request.url);
  publicUrl.pathname = `/images/${key}`;
  publicUrl.search = "";

  return json({
    key,
    url: publicUrl.toString(),
    contentType,
    uploadedBy: session.userId,
  });
};

export const onRequest: PagesFunction = () => methodNotAllowed("POST");
