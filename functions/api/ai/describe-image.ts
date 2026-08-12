import { getBearerToken, verifyToken } from "../../_lib/auth";
import { stripDataUrlPrefix } from "../../_lib/base64";
import { requireJwtEnv, requireVisionEnv } from "../../_lib/env";
import { badRequest, json, methodNotAllowed, unauthorized } from "../../_lib/http";
import { describeEvidenceImage } from "../../_lib/vision";

type Env = {
  AUTH_SECRET: string;
  OPENAI_API_KEY?: string;
  AI?: {
    run: (model: string, inputs: Record<string, unknown>) => Promise<{ response?: string }>;
  };
};

type DescribeBody = {
  imageBase64?: string;
  contentType?: string;
  language?: string;
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const jwtEnvError = requireJwtEnv(context.env);
  if (jwtEnvError) return jwtEnvError;

  const visionEnvError = requireVisionEnv(context.env);
  if (visionEnvError) return visionEnvError;

  const token = getBearerToken(context.request);
  if (!token) return unauthorized("Missing Bearer token");

  let session;
  try {
    session = await verifyToken(token, context.env.AUTH_SECRET);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token verification failed";
    return json({ error: message }, 500);
  }
  if (!session) return unauthorized("Invalid or expired token");

  let body: DescribeBody;
  try {
    body = (await context.request.json()) as DescribeBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const rawImage = body.imageBase64?.trim();
  if (!rawImage) {
    return badRequest("imageBase64 is required");
  }

  const stripped = stripDataUrlPrefix(rawImage);
  const contentType = body.contentType?.trim() || stripped.contentType || "image/jpeg";
  const language = body.language?.trim() || "en";

  try {
    const result = await describeEvidenceImage(
      context.env,
      stripped.base64,
      contentType,
      language,
    );
    return json({ description: result.description, language: result.language });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vision request failed";
    if (message.includes("2 MB")) {
      return badRequest(message);
    }
    return json({ error: message }, 502);
  }
};

export const onRequest: PagesFunction = () => methodNotAllowed("POST");
