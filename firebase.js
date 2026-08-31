// Firebase project config. These values are safe to keep public — they
// just tell the app which Firebase project to talk to. Actual security
// is enforced by the Firestore rules (see README), which only let a
// signed-in user read/write their own data.
//
// Get these from: Firebase Console -> Project Settings -> General ->
// "Your apps" -> Web app -> SDK setup and configuration -> Config.
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "firebase/firestore";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// persistentLocalCache = Firestore keeps a local IndexedDB cache and
// works fully offline, syncing automatically when back online. This is
// what gives us "offline-first with sync" instead of "online-only".
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager(),
  }),
});

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutOfGoogle() {
  return fbSignOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export { auth, db };
