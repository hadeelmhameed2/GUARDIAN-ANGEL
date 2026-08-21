import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { readSecureItem, writeSecureItem } from './secure-storage';

export type WriteResult = { ok: boolean; quota?: boolean };

export async function readJournalRaw(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeJournalRaw(key: string, value: string): Promise<WriteResult> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return { ok: false };
    try {
      window.localStorage.setItem(key, value);
      return { ok: true };
    } catch (error: any) {
      const isQuota =
        error?.name === 'QuotaExceededError' ||
        error?.code === 22 ||
        error?.code === 1014 ||
        error?.name === 'NS_ERROR_DOM_QUOTA_REACHED';
      return { ok: false, quota: isQuota };
    }
  }
  try {
    await AsyncStorage.setItem(key, value);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

// --- Encryption at rest -----------------------------------------------
//
// Journal entries (photos, audio, descriptions) are the most sensitive data
// in the app, so they're encrypted with AES-GCM before ever touching
// AsyncStorage/localStorage. The symmetric key lives in SecureStore
// (Keychain/Keystore on native; the secure-storage.ts localStorage shim on
// web, matching every other "secure" value in this app).

const JOURNAL_ENC_KEY_STORAGE_KEY = 'ga_journal_enc_key_v1';
const ENVELOPE_PREFIX = 'gaenc1:';
const AES_KEY_BYTES = 32; // 256-bit
const GCM_IV_BYTES = 12;

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    result += BASE64_CHARS[b0 >> 2];
    result += BASE64_CHARS[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    result += b1 === undefined ? '=' : BASE64_CHARS[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    result += b2 === undefined ? '=' : BASE64_CHARS[b2 & 0x3f];
  }
  return result;
}

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i += 1) {
    const value = BASE64_CHARS.indexOf(clean[i]);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function getWebCrypto(): Crypto | null {
  if (typeof globalThis === 'undefined') return null;
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle || typeof cryptoObj.getRandomValues !== 'function') return null;
  return cryptoObj;
}

async function getOrCreateJournalKey(cryptoObj: Crypto): Promise<CryptoKey | null> {
  try {
    let rawKeyB64 = await readSecureItem(JOURNAL_ENC_KEY_STORAGE_KEY);
    if (!rawKeyB64) {
      const keyBytes = cryptoObj.getRandomValues(new Uint8Array(AES_KEY_BYTES));
      rawKeyB64 = bytesToBase64(keyBytes);
      await writeSecureItem(JOURNAL_ENC_KEY_STORAGE_KEY, rawKeyB64);
    }
    const keyBytes = base64ToBytes(rawKeyB64);
    return await cryptoObj.subtle.importKey('raw', keyBytes as BufferSource, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
  } catch {
    return null;
  }
}

async function encryptJournalPayload(plaintext: string): Promise<string | null> {
  const cryptoObj = getWebCrypto();
  if (!cryptoObj) return null;
  const key = await getOrCreateJournalKey(cryptoObj);
  if (!key) return null;
  try {
    const iv = cryptoObj.getRandomValues(new Uint8Array(GCM_IV_BYTES));
    const encoded = new TextEncoder().encode(plaintext);
    const cipherBuffer = await cryptoObj.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, encoded);
    const cipherBytes = new Uint8Array(cipherBuffer);
    return `${ENVELOPE_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(cipherBytes)}`;
  } catch {
    return null;
  }
}

async function decryptJournalPayload(envelope: string): Promise<string | null> {
  const cryptoObj = getWebCrypto();
  if (!cryptoObj) return null;
  const key = await getOrCreateJournalKey(cryptoObj);
  if (!key) return null;
  const body = envelope.slice(ENVELOPE_PREFIX.length);
  const [ivB64, cipherB64] = body.split(':');
  if (!ivB64 || !cipherB64) return null;
  try {
    const iv = base64ToBytes(ivB64);
    const cipherBytes = base64ToBytes(cipherB64);
    const plainBuffer = await cryptoObj.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource,
    );
    return new TextDecoder().decode(plainBuffer);
  } catch {
    return null;
  }
}

/**
 * Reads journal data, transparently decrypting entries written by
 * {@link writeEncryptedJournal}. Falls back to legacy plaintext for data
 * written before encryption-at-rest was added, so upgrading never loses an
 * existing evidence journal — the next write re-encrypts it.
 */
export async function readDecryptedJournal(key: string): Promise<string | null> {
  const raw = await readJournalRaw(key);
  if (!raw) return null;
  if (raw.startsWith(ENVELOPE_PREFIX)) {
    return decryptJournalPayload(raw);
  }
  return raw;
}

/**
 * Encrypts journal data with AES-GCM before persisting it. If Web Crypto is
 * unavailable on this platform, stores plaintext rather than losing data —
 * matches the same degrade-gracefully convention used for the evidence hash
 * chain (src/evidence.ts).
 */
export async function writeEncryptedJournal(key: string, plaintext: string): Promise<WriteResult> {
  const envelope = await encryptJournalPayload(plaintext);
  return writeJournalRaw(key, envelope ?? plaintext);
}
