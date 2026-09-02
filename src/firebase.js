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
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "firebase/firestore";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

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

// A popup has nowhere to render when the app is running installed
// (standalone / home-screen) — there's no browser chrome around it —
// so in that case we do a full-page redirect sign-in instead.
function isInstalledApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

// Inside the native Capacitor app, Google actively blocks its sign-in
// page from loading in a generic embedded webview, so signInWithPopup /
// signInWithRedirect simply don't work there. Instead we use the native
// Google Sign-In SDK (via @capacitor-firebase/authentication) to get a
// real ID token, then hand that token to the Firebase JS SDK so the rest
// of the app (auth.currentUser, onAuthStateChanged, Firestore) behaves
// exactly the same regardless of which platform we're on.
async function signInWithGoogleNative() {
  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential && result.credential.idToken;
  if (!idToken) {
    throw new Error("Google didn't return a usable sign-in token.");
  }
  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

export function signInWithGoogle() {
  if (Capacitor.isNativePlatform()) {
    return signInWithGoogleNative();
  }
  if (isInstalledApp()) {
    // On Android, this navigates out of the installed app's own window into
    // a regular browser tab (accounts.google.com is outside the installed
    // app's scope). We flag that a redirect sign-in is in progress so that,
    // when the user switches back to the installed app, main.jsx knows to
    // reload it and pick up the now-persisted sign-in.
    try {
      window.localStorage.setItem("trainlog_pending_redirect_signin", "1");
    } catch (e) {
      // localStorage unavailable — sign-in will still work, it just won't
      // auto-refresh the installed app window; a manual reopen will do it.
    }
    return signInWithRedirect(auth, googleProvider);
  }
  return signInWithPopup(auth, googleProvider).catch((err) => {
    // Some browsers/webviews block or simply don't support popups even
    // when not "installed" — fall back to redirect rather than failing.
    if (
      err.code === "auth/popup-blocked" ||
      err.code === "auth/operation-not-supported-in-this-environment"
    ) {
      try {
        window.localStorage.setItem("trainlog_pending_redirect_signin", "1");
      } catch (e) {
        // Ignore — see comment above.
      }
      return signInWithRedirect(auth, googleProvider);
    }
    throw err;
  });
}

// Call once at startup so a pending redirect-based sign-in (from the
// installed-app path above) gets picked up after the page reloads.
export async function completeRedirectSignIn() {
  let hadPendingRedirect = false;
  try {
    hadPendingRedirect = window.localStorage.getItem("trainlog_pending_redirect_signin") === "1";
  } catch (e) {
    hadPendingRedirect = false;
  }

  let result = null;
  try {
    result = await getRedirectResult(auth);
  } catch (err) {
    console.error("Redirect sign-in failed:", err);
    try {
      window.alert(
        "Sign-in error (" + (err && err.code ? err.code : "unknown") + "): " +
          (err && err.message ? err.message : String(err))
      );
    } catch (e) {
      // ignore
    }
  }

  if (hadPendingRedirect) {
    try {
      window.localStorage.removeItem("trainlog_pending_redirect_signin");
    } catch (e) {
      // ignore
    }
    // We expected to come back signed in, but there's no user — this is
    // the known Android installed-app case where the redirect result gets
    // silently lost. Let the UI explain the workaround instead of just
    // looking broken.
    if (!result && !auth.currentUser) {
      window.dispatchEvent(new CustomEvent("trainlog-signin-incomplete"));
    }
  }

  return result;
}

export async function signOutOfGoogle() {
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch (e) {
      // Not fatal — proceed to sign out of the JS SDK regardless.
    }
  }
  return fbSignOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export { auth, db };
