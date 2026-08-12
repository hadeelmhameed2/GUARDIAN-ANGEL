import { corsJsonError, corsPreflightResponse, withCors } from "./_lib/cors";

export const onRequest: PagesFunction = async (context) => {
  if (context.request.method === "OPTIONS") {
    return corsPreflightResponse();
  }

  try {
    const response = await context.next();
    return withCors(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return corsJsonError(message, 500);
  }
};
