import { base64ToUint8Array, stripDataUrlPrefix, toVisionDataUrl } from "./base64";

export type CaptionLanguage = "en" | "he" | "ar";

export function normalizeCaptionLanguage(language?: string | null): CaptionLanguage {
  const code = language?.trim().toLowerCase().split("-")[0];
  if (code === "he" || code === "ar") return code;
  return "en";
}

const EVIDENCE_VISION_RULES = `You are an evidence documentation assistant for a personal safety journal.
Describe only what is visibly present in the image.
Use objective, factual language suitable for legal or forensic records.
Do not speculate about intent, emotions, identities, or events not directly visible.
Note visible objects, people (without naming individuals), injuries if clearly visible, locations, damage, documents, screens, or environmental conditions.
Do not use emotional, judgmental, or sensational language.
Keep the description concise (3-6 sentences).`;

export function buildEvidenceVisionSystemPrompt(language: CaptionLanguage): string {
  const outputLanguageRule =
    language === "he"
      ? "CRITICAL: Your entire response MUST be written in Hebrew (עברית) only. Do not use English or Latin script."
      : language === "ar"
        ? "CRITICAL: Your entire response MUST be written in Arabic (العربية) only. Do not use English or Latin script."
        : "Write your entire response in English.";

  return `${EVIDENCE_VISION_RULES}\n${outputLanguageRule}`;
}

export function buildEvidenceVisionUserPrompt(language: CaptionLanguage): string {
  if (language === "he") {
    return "ספק/י תיאור עובדתי, אובייקטיבי ותמציתי של מה שרואים בתמונה. כתוב/י בעברית בלבד.";
  }
  if (language === "ar") {
    return "قدّم وصفًا موضوعيًا و واقعيًا وموجزًا لما يظهر في الصورة. اكتب بالعربية فقط.";
  }
  return "Provide an objective, factual, and concise description of this image in English.";
}

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

function normalizeDescription(text: string, language: CaptionLanguage): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (language === "he" || language === "ar") {
    return collapsed;
  }
  return collapsed;
}

async function describeWithOpenAI(
  apiKey: string,
  imageDataUrl: string,
  systemPrompt: string,
  userPrompt: string,
  language: CaptionLanguage,
): Promise<string> {
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
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
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
  return normalizeDescription(description, language);
}

async function agreeToMetaVisionTerms(ai: CloudflareAiBinding): Promise<void> {
  try {
    await ai.run(CLOUDFLARE_VISION_MODEL, { prompt: "agree" });
  } catch {
    // Ignore — only needed once per account; retry handles persistent license errors.
  }
}

async function describeWithCloudflareAi(
  ai: CloudflareAiBinding,
  imageDataUrl: string,
  systemPrompt: string,
  userPrompt: string,
  language: CaptionLanguage,
): Promise<string> {
  const runVision = () =>
    ai.run(CLOUDFLARE_VISION_MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
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
  return normalizeDescription(description, language);
}

export async function describeEvidenceImage(
  env: { OPENAI_API_KEY?: string; AI?: CloudflareAiBinding },
  imageBase64: string,
  contentType = "image/jpeg",
  language?: string | null,
): Promise<{ description: string; language: CaptionLanguage }> {
  const stripped = stripDataUrlPrefix(imageBase64);
  const bytes = base64ToUint8Array(stripped.base64);
  if (bytes.byteLength === 0) {
    throw new Error("Image payload is empty");
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image exceeds the 2 MB upload limit");
  }

  const captionLanguage = normalizeCaptionLanguage(language);
  const mime = stripped.contentType ?? contentType;
  const dataUrl = toVisionDataUrl(stripped.base64, mime);
  const systemPrompt = buildEvidenceVisionSystemPrompt(captionLanguage);
  const userPrompt = buildEvidenceVisionUserPrompt(captionLanguage);

  let description: string;
  if (env.OPENAI_API_KEY?.trim()) {
    description = await describeWithOpenAI(
      env.OPENAI_API_KEY,
      dataUrl,
      systemPrompt,
      userPrompt,
      captionLanguage,
    );
  } else if (env.AI?.run) {
    description = await describeWithCloudflareAi(
      env.AI,
      dataUrl,
      systemPrompt,
      userPrompt,
      captionLanguage,
    );
  } else {
    throw new Error("No vision provider configured (set OPENAI_API_KEY or bind Workers AI)");
  }

  return { description, language: captionLanguage };
}
