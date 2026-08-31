// Same {get,set,delete,list} shape as storagePolyfill.js (IndexedDB),
// but backed by Firestore under the signed-in user's own uid, so the
// SAME app code (App.jsx) works with either backend — only main.jsx
// decides which one window.storage points to, based on auth state.
//
// Firestore's persistentLocalCache (configured in firebase.js) keeps
// everything cached on-device too, so this stays offline-capable and
// syncs automatically once the device is back online.

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  documentId,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase.js";

function scopedDocId(key, shared) {
  return `${shared ? "shared" : "priv"}:${key}`;
}

function kvCollection() {
  const uid = auth.currentUser && auth.currentUser.uid;
  if (!uid) throw new Error("Not signed in.");
  return collection(db, "users", uid, "kv");
}

export const firebaseStorage = {
  async get(key, shared = false) {
    const ref = doc(kvCollection(), scopedDocId(key, shared));
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error(`Key not found: ${key}`);
    }
    return { key, value: snap.data().value, shared };
  },

  async set(key, value, shared = false) {
    const ref = doc(kvCollection(), scopedDocId(key, shared));
    await setDoc(ref, { value, updatedAt: serverTimestamp() });
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    const ref = doc(kvCollection(), scopedDocId(key, shared));
    await deleteDoc(ref);
    return { key, deleted: true, shared };
  },

  async list(prefix = "", shared = false) {
    const col = kvCollection();
    const scopedPrefix = scopedDocId(prefix, shared);
    const q = query(
      col,
      where(documentId(), ">=", scopedPrefix),
      where(documentId(), "<", scopedPrefix + "\uf8ff")
    );
    const snap = await getDocs(q);
    const keys = [];
    snap.forEach((d) => keys.push(d.id.slice(scopedDocId("", shared).length)));
    return { keys, prefix, shared };
  },
};
