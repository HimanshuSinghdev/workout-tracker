// Firebase project config. These values are safe to keep public — they
// just tell the app which Firebase project to talk to. Actual security
// is enforced by the Firestore rules (see README), which only let a
// signed-in user read/write their own data.
//
// Get these from: Firebase Console -> Project Settings -> General ->
// "Your apps" -> Web app -> SDK setup and configuration -> Config.
const firebaseConfig = {
  apiKey: "AIzaSyA-H1jtiGKcI3ZV9-1KiBa3CZiH3Az-B_8",
  authDomain: "train-log-b2e12.firebaseapp.com",
  projectId: "train-log-b2e12",
  storageBucket: "train-log-b2e12.firebasestorage.app",
  messagingSenderId: "1079206932137",
  appId: "1:1079206932137:web:0d1916c5c7ead236b2c3b8",
  measurementId: "G-GG8C2F03P4"
};
// Firebase project config. These values are safe to keep public — they
// just tell the app which Firebase project to talk to. Actual security
// is enforced by the Firestore rules (see README), which only let a
// signed-in user read/write their own data.
//
// Get these from: Firebase Console -> Project Settings -> General ->
// "Your apps" -> Web app -> SDK setup and configuration -> Config.
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
 
// A popup has nowhere to render when the app is running installed
// (standalone / home-screen) — there's no browser chrome around it —
// so in that case we do a full-page redirect sign-in instead.
function isInstalledApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}
 
export function signInWithGoogle() {
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
export function completeRedirectSignIn() {
  return getRedirectResult(auth).catch(() => null);
}
 
export function signOutOfGoogle() {
  return fbSignOut(auth);
}
 
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
 
export { auth, db };
