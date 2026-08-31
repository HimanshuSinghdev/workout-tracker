// Replaces the Claude-artifact-only `window.storage` API with a real,
// browser-native equivalent backed by IndexedDB (much bigger quota than
// localStorage, which matters since this app stores base64 photos).
//
// Data lives in EACH VISITOR'S OWN BROWSER (per-device, per-origin). It is
// not synced between users or devices — that's expected for a static site
// with client-side storage. Users can back up / move data with the
// app's own Export / Import buttons.

const DB_NAME = "workout-tracker-db";
const STORE_NAME = "kv";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const result = fn(store);
        tx.oncomplete = () => resolve(result.value);
        tx.onerror = () => reject(tx.error);
        if (result.onsuccess !== undefined) {
          result.request.onsuccess = () => {
            result.value = result.request.result;
          };
        }
      })
  );
}

function idbGet(key) {
  return withStore("readonly", (store) => {
    const request = store.get(key);
    return { request, onsuccess: true, value: undefined };
  });
}

function idbSet(key, value) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function idbDelete(key) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function idbAllKeys() {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).getAllKeys();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

function scopedKey(key, shared) {
  return `${shared ? "shared" : "priv"}:${key}`;
}

// Exported (not just assigned to window.storage) so main.jsx can switch
// back to this local-only backend when the user signs out of Google.
export const localStorageBackend = {
  async get(key, shared = false) {
    const value = await idbGet(scopedKey(key, shared));
    if (value === undefined) {
      throw new Error(`Key not found: ${key}`);
    }
    return { key, value, shared };
  },

  async set(key, value, shared = false) {
    await idbSet(scopedKey(key, shared), value);
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    await idbDelete(scopedKey(key, shared));
    return { key, deleted: true, shared };
  },

  async list(prefix = "", shared = false) {
    const scopedPrefix = scopedKey(prefix, shared);
    const allKeys = await idbAllKeys();
    const keys = allKeys
      .filter((k) => typeof k === "string" && k.startsWith(scopedPrefix))
      .map((k) => k.slice(scopedKey("", shared).length));
    return { keys, prefix, shared };
  },
};

window.storage = localStorageBackend;
