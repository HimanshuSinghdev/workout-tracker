import React from "react";
import ReactDOM from "react-dom/client";
import "./storagePolyfill.js";
import WorkoutTracker from "./App.jsx";

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
