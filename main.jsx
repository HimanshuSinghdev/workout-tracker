import React from "react";
import ReactDOM from "react-dom/client";
import { localStorageBackend } from "./storagePolyfill.js";
import { firebaseStorage } from "./firebaseStorage.js";
import { watchAuthState } from "./firebase.js";
import WorkoutTracker from "./App.jsx";

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
