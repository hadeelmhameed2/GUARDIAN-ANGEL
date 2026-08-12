import { base64ToUint8Array, stripDataUrlPrefix, toVisionDataUrl } from "./base64";

export const EVIDENCE_VISION_SYSTEM_PROMPT = `You are an evidence documentation assistant for a personal safety journal.
Describe only what is visibly present in the image.
Use objective, factual language suitable for legal or forensic records.
Do not speculate about intent, emotions, identities, or events not directly visible.
Note visible objects, people (without naming individuals), injuries if clearly visible, locations, damage, documents, screens, or environmental conditions.
Do not use emotional, judgmental, or sensational language.
Keep the description concise (3-6 sentences).`;

type OpenAiChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

type CloudflareAiBinding = {
  run: (model: string, inputs: Record<string, unknown>) => Promise<{ response?: string }>;
};

const OPENAI_MODEL = "gpt-4o-mini";
const CLOUDFLARE_VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function normalizeDescription(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function describeWithOpenAI(apiKey: string, imageDataUrl: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      max_tokens: 320,
      messages: [
        { role: "system", content: EVIDENCE_VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Provide a factual evidence description of this image.",
            },
            {
              type: "image_url",
              image_url: { url: imageDataUrl, detail: "low" },
            },
          ],
        },
      ],
    }),
  });

  const payload = (await response.json()) as OpenAiChatResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenAI request failed (${response.status})`);
  }

  const description = payload.choices?.[0]?.message?.content;
  if (!description?.trim()) {
    throw new Error("OpenAI returned an empty description");
  }
  return normalizeDescription(description);
}

async function agreeToMetaVisionTerms(ai: CloudflareAiBinding): Promise<void> {
  try {
    await ai.run(CLOUDFLARE_VISION_MODEL, { prompt: "agree" });
  } catch {
    // Ignore — only needed once per account; retry handles persistent license errors.
  }
}

async function describeWithCloudflareAi(ai: CloudflareAiBinding, imageDataUrl: string): Promise<string> {
  const runVision = () =>
    ai.run(CLOUDFLARE_VISION_MODEL, {
      messages: [
        { role: "system", content: EVIDENCE_VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Provide a factual evidence description of this image." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      max_tokens: 320,
    });

  let result: { response?: string };
  try {
    result = await runVision();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workers AI request failed";
    if (/license|acceptable use|agree/i.test(message)) {
      await agreeToMetaVisionTerms(ai);
      result = await runVision();
    } else {
      throw new Error(`Workers AI error: ${message}`);
    }
  }

  const description = result.response;
  if (!description?.trim()) {
    throw new Error("Workers AI returned an empty description");
  }
  return normalizeDescription(description);
}

export async function describeEvidenceImage(
  env: { OPENAI_API_KEY?: string; AI?: CloudflareAiBinding },
  imageBase64: string,
  contentType = "image/jpeg",
): Promise<string> {
  const stripped = stripDataUrlPrefix(imageBase64);
  const bytes = base64ToUint8Array(stripped.base64);
  if (bytes.byteLength === 0) {
    throw new Error("Image payload is empty");
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 2 MB upload limit");
  }

  const mime = stripped.contentType ?? contentType;
  const dataUrl = toVisionDataUrl(stripped.base64, mime);

  if (env.OPENAI_API_KEY?.trim()) {
    return describeWithOpenAI(env.OPENAI_API_KEY, dataUrl);
  }
  if (env.AI?.run) {
    return describeWithCloudflareAi(env.AI, dataUrl);
  }
  throw new Error("No vision provider configured (set OPENAI_API_KEY or bind Workers AI)");
}
