// Web-only: persists non-extractable WebCrypto CryptoKey objects in
// IndexedDB. Unlike localStorage (string-only), IndexedDB's structured-clone
// algorithm can store and retrieve a CryptoKey object directly — including
// one created with `extractable: false` — without ever touching its raw key
// bytes. That's the property this module exists for: a key that can be
// *used* to encrypt/decrypt but never *read out* as bytes by application
// code (or by anything that can only inspect stored data, not execute JS in
// this origin — see the caveat on getOrCreateNonExtractableAesKey below).
//
// No new dependency: this wraps the native `indexedDB` API directly rather
// than pulling in a helper library — the surface needed (get/put one record
// in one object store) is small enough not to warrant one.

const DB_NAME = 'ga_secure_keys_v1';
const DB_VERSION = 1;
const STORE_NAME = 'crypto_keys';

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openKeyDbUncached(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

async function openKeyDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openKeyDbUncached();
  }
  try {
    return await dbPromise;
  } catch (error) {
    // Don't cache a rejected connection — let the next call retry.
    dbPromise = null;
    throw error;
  }
}

export async function getStoredCryptoKey(recordKey: string): Promise<CryptoKey | null> {
  if (!isIndexedDbAvailable()) return null;
  try {
    const db = await openKeyDb();
    return await new Promise<CryptoKey | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(recordKey);
      request.onsuccess = () => resolve((request.result as CryptoKey | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
    });
  } catch {
    return null;
  }
}

export async function putStoredCryptoKey(recordKey: string, key: CryptoKey): Promise<boolean> {
  if (!isIndexedDbAvailable()) return false;
  try {
    const db = await openKeyDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(key, recordKey);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function deleteStoredCryptoKey(recordKey: string): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  try {
    const db = await openKeyDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(recordKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore — worst case the old record lingers, which is harmless
  }
}
