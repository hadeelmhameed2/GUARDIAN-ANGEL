import { getBearerToken, verifyToken } from "../../_lib/auth";
import { requireJwtEnv } from "../../_lib/env";
import { badRequest, json, methodNotAllowed, unauthorized } from "../../_lib/http";

type Env = {
  AUTH_SECRET: string;
  /** All three required for a real send; if any is missing, dispatch runs in demo mode. */
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
};

type TwilioEnv = Env & {
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
};

type SosSendBody = {
  phone?: string;
  message?: string;
};

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

function hasTwilioConfig(env: Env): env is TwilioEnv {
  return Boolean(env.TWILIO_ACCOUNT_SID?.trim() && env.TWILIO_AUTH_TOKEN?.trim() && env.TWILIO_FROM_NUMBER?.trim());
}

/** Masks all but the last 4 digits — enough to correlate a log line with a user report without printing the full number. */
function maskPhone(phone: string): string {
  return phone.length > 4 ? `${"*".repeat(phone.length - 4)}${phone.slice(-4)}` : phone;
}

async function sendViaTwilio(env: TwilioEnv, to: string, body: string): Promise<Response> {
  const credentials = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  const form = new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER, Body: body });

  const twilioResponse = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );

  const payload = (await twilioResponse.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!twilioResponse.ok) {
    return json({ error: payload.message || "SMS gateway rejected the request" }, 502);
  }
  return json({ success: true, mocked: false, sid: payload.sid });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const jwtEnvError = requireJwtEnv(context.env);
  if (jwtEnvError) return jwtEnvError;

  const token = getBearerToken(context.request);
  if (!token) return unauthorized("Missing Bearer token");

  const session = await verifyToken(token, context.env.AUTH_SECRET);
  if (!session) return unauthorized("Invalid or expired token");

  let body: SosSendBody;
  try {
    body = (await context.request.json()) as SosSendBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const phone = body.phone?.replace(/\s+/g, "").trim();
  const message = body.message?.trim();
  if (!phone || !PHONE_PATTERN.test(phone)) {
    return badRequest("A valid phone number is required");
  }
  if (!message) {
    return badRequest("message is required");
  }

  const env = context.env;
  if (hasTwilioConfig(env)) {
    try {
      return await sendViaTwilio(env, phone, message);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "SMS gateway request failed";
      return json({ error: messageText }, 502);
    }
  }

  // Demo mode: no SMS gateway provisioned yet. Log server-side proof that an
  // authenticated dispatch request actually reached the backend, simulate
  // network latency, and report success — exercises the app's full request
  // path (auth, validation, response contract) before Twilio is wired up.
  console.log(
    `[sos] DEMO MODE — would dispatch SOS SMS to ${maskPhone(phone)} (user ${session.sub}, message ${message.length} chars). Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER to send for real.`,
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return json({ success: true, mocked: true });
};

export const onRequest: PagesFunction = () => methodNotAllowed("POST");
