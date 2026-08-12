import { apiFetch } from '@/src/api';
import { AUTH_TOKEN_KEY, readSecureItem } from '@/src/secure-storage';

const MAX_API_IMAGE_BYTES = 1_500_000;
const LOG_PREFIX = '[journal-ai-caption]';

export type DescribeImageFailureReason =
  | 'no_token'
  | 'unauthorized'
  | 'network'
  | 'empty'
  | 'too_large'
  | 'server'
  | 'misconfigured';

export type DescribeImageResult =
  | { ok: true; description: string }
  | { ok: false; reason: DescribeImageFailureReason; message: string; status?: number };

function estimateBase64Bytes(dataUrlOrBase64: string): number {
  const base64 = dataUrlOrBase64.includes(',') ? dataUrlOrBase64.split(',')[1] : dataUrlOrBase64;
  return Math.floor((base64.length * 3) / 4);
}

function extractContentType(imageBase64: string): string {
  const match = imageBase64.match(/^data:([^;]+);/);
  return match?.[1] ?? 'image/jpeg';
}

function stripDataUrl(imageBase64: string): string {
  const match = imageBase64.match(/^data:[^;]+;base64,(.+)$/);
  return match?.[1] ?? imageBase64;
}

function mapFailureReason(status: number, errorMessage?: string): DescribeImageFailureReason {
  if (status === 401) return 'unauthorized';
  if (status === 503 && errorMessage?.includes('not configured')) return 'misconfigured';
  return 'server';
}

/**
 * Requests a factual AI caption for a journal image. API keys stay on the server.
 * Returns structured errors so the UI can fall back to manual entry.
 */
export async function describeJournalImage(imageBase64: string): Promise<DescribeImageResult> {
  if (estimateBase64Bytes(imageBase64) > MAX_API_IMAGE_BYTES) {
    return { ok: false, reason: 'too_large', message: 'Image exceeds the 1.5 MB client upload limit' };
  }

  const token = await readSecureItem(AUTH_TOKEN_KEY);
  if (!token || token.startsWith('local-dev-')) {
    console.warn(LOG_PREFIX, 'Skipped: no server auth token (register or log in first)');
    return { ok: false, reason: 'no_token', message: 'Sign in with your calculator PIN to use AI captioning' };
  }

  const payloadBase64 = stripDataUrl(imageBase64);
  const contentType = extractContentType(imageBase64);

  try {
    const response = await apiFetch('/api/ai/describe-image', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageBase64: payloadBase64,
        contentType,
      }),
    });

    let body: { description?: string; error?: string } = {};
    try {
      body = (await response.json()) as { description?: string; error?: string };
    } catch {
      body = { error: 'Non-JSON response from server' };
    }

    if (!response.ok) {
      const message = body.error?.trim() || `Request failed (${response.status})`;
      const reason = mapFailureReason(response.status, message);
      console.warn(LOG_PREFIX, 'API error', {
        status: response.status,
        reason,
        message,
        contentType,
        imageBytes: estimateBase64Bytes(payloadBase64),
        tokenPrefix: `${token.slice(0, 8)}…`,
      });
      return { ok: false, reason, message, status: response.status };
    }

    const description = body.description?.trim();
    if (!description) {
      console.warn(LOG_PREFIX, 'Empty description in success response', body);
      return { ok: false, reason: 'empty', message: 'AI returned an empty description' };
    }

    console.info(LOG_PREFIX, 'Caption generated', { length: description.length });
    return { ok: true, description };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    console.warn(LOG_PREFIX, 'Network failure', { message, error });
    return { ok: false, reason: 'network', message };
  }
}

export function appendJournalCaption(existing: string, caption: string): string {
  const trimmedCaption = caption.trim();
  if (!trimmedCaption) return existing;
  const trimmedExisting = existing.trim();
  if (!trimmedExisting) return trimmedCaption;
  return `${trimmedExisting}\n\n${trimmedCaption}`;
}

export function describeImageErrorMessage(
  reason: DescribeImageFailureReason,
  t: (key: string) => string,
  apiMessage?: string,
): string {
  switch (reason) {
    case 'no_token':
      return t('homeScreen.journal.captionErrorNoToken');
    case 'unauthorized':
      return t('homeScreen.journal.captionErrorUnauthorized');
    case 'too_large':
      return t('homeScreen.journal.captionErrorTooLarge');
    case 'misconfigured':
      return apiMessage ?? t('homeScreen.journal.captionErrorMisconfigured');
    case 'network':
      return t('homeScreen.journal.captionErrorNetwork');
    case 'empty':
      return t('homeScreen.journal.captionErrorEmpty');
    default:
      return apiMessage ?? t('homeScreen.journal.captionErrorServer');
  }
}
