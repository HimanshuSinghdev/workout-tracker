# 🦇 TRAIN LOG

<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=FFD23F&height=150&section=header&text=TRAIN%20LOG&fontSize=50&fontColor=14161A&animation=fadeIn" alt="Train Log Header" />

  <p><strong>A sleek, offline-first React fitness tracker for logging daily weight, snapping progress photos, and visually tracking your lean mass gains.</strong></p>

  <!-- LIVE DEMO BUTTON -->
  <a href="https://himanshusinghdev.github.io/workout-tracker/" target="_blank">
    <img src="https://img.shields.io/badge/🚀_OPEN_LIVE_APP-FFD23F?style=for-the-badge&logoColor=14161A&textColor=14161A" alt="Open Live App" />
  </a>

  <br />
  <br />

  <!-- BADGES -->
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Offline_First-14161A?style=flat-square&logo=pwa&logoColor=FFD23F" alt="Offline First" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</div>

---

## 🎥 The Aesthetic & The Grind

**TRAIN LOG** is a highly visual, aesthetic-driven workout tracker designed for the modern gym-goer. Because tracking progress is about more than just numbers, this app focuses on what you actually see.

Whether you are bulking up or steadily building lean mass, this tracker keeps you accountable. Log your daily weight, attach a post-workout progress picture with cinematic lighting, and let the app handle the rest. Compare "Day 1" to "Day 30" with built-in visual side-by-sides, track your weight spikes on the sparkline trend graph, and never lose your streak.

> **Note on Privacy:** All your photos are compressed, optimized, and securely stored *right in your browser*. Nothing is sent to a server.

---

## ✨ Key Features

*   📸 **Visual Side-by-Side Comparison:** Select any two days from your log to compare your physique and calculate the exact weight change and days elapsed.
*   📉 **Sparkline Trend Graphs:** Watch your trajectory with a dynamic, auto-scaling line chart that maps your weight over time.
*   🗜️ **On-the-Fly Image Optimization:** Uses HTML5 Canvas to instantly resize and compress high-resolution photos before saving them to your device storage.
*   🌙 **Cinematic Dark Mode UI:** A distraction-free, high-contrast dark interface featuring neon accents (`#FFD23F`) designed to look great in the gym.
*   💾 **Local Storage & Backups:** 100% offline functionality. Export your entire log (photos included) as a single JSON file and import it anywhere.
*   📲 **Installable PWA:** Add it to your Android home screen from Chrome for a standalone app-like experience, with offline caching via a service worker.

---

## 🚀 Quick Start (Local Development)

To run this project locally on your machine, follow these steps:

**1. Clone the repository**

```bash
git clone https://github.com/HimanshuSinghdev/workout-tracker.git
cd workout-tracker
```

**2. Install dependencies**

```bash
npm install
```

**3. Start the development server**

```bash
npm run dev
```

Open `http://localhost:5173` in your browser to view the app.

---

## 🌐 Deployment

Every push to `main` automatically rebuilds and redeploys the live app via GitHub Actions — no manual build step needed. See `.github/workflows/deploy.yml`.

---

## 🛠️ Built With

*   **[React](https://reactjs.org/)** - UI Framework (Hooks: `useState`, `useEffect`, `useRef`, `useCallback`)
*   **[Lucide React](https://lucide.dev/)** - Clean, crisp iconography
*   **[Vite](https://vitejs.dev/)** - Build tool
*   **IndexedDB** - Persistent offline browser data
*   **HTML5 Canvas API** - Client-side image processing
*   **Service Worker** - Offline caching + installability

---

## 🤝 Crafted By

Designed and developed by **Himanshu**.

If you like this project, feel free to give it a ⭐️ on GitHub!
