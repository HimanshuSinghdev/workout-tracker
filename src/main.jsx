import React from "react";
import ReactDOM from "react-dom/client";
import { localStorageBackend } from "./storagePolyfill.js";
import { firebaseStorage } from "./firebaseStorage.js";
import { watchAuthState, completeRedirectSignIn } from "./firebase.js";
import WorkoutTracker from "./App.jsx";

// Picks up the result of a redirect-based sign-in (used when the app is
// running installed/standalone) after the page reloads back to the app.
completeRedirectSignIn();

// On Android, an installed app's sign-in button sends the user out to a
// separate browser tab to complete Google sign-in (see firebase.js). This
// installed-app window is left sitting in the background the whole time,
// so when the user switches back to it, force a reload to pick up the
// now-persisted sign-in instead of silently staying on the stale,
// signed-out screen.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  let pending = false;
  try {
    pending = window.localStorage.getItem("trainlog_pending_redirect_signin") === "1";
  } catch (e) {
    pending = false;
  }
  if (pending) {
    try {
      window.localStorage.removeItem("trainlog_pending_redirect_signin");
    } catch (e) {
      // Ignore — worst case this check runs again next time visible.
    }
    window.location.reload();
  }
});


// Default to the local (IndexedDB) backend so the app works fully
// offline / signed-out, exactly as before.
window.storage = localStorageBackend;

// When auth state changes (sign in / sign out / page load with an
// existing session), swap window.storage to the right backend and let
// the app know so it can reload its data from the new source.
watchAuthState((user) => {
  window.storage = user ? firebaseStorage : localStorageBackend;
  window.dispatchEvent(
    new CustomEvent("storage-backend-changed", { detail: { signedIn: !!user, user } })
  );
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WorkoutTracker />
  </React.StrictMode>
);

// Register the service worker (required by Chrome on Android before it
// will offer the "Install app" prompt) + gives basic offline support.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((err) => console.warn("Service worker registration failed:", err));
  });
}
