import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` defaults to "/" for local dev (npm run dev / npm run build).
// The GitHub Actions workflow overrides this at build time with
// --base=/<repo-name>/ so it works correctly on GitHub Pages
// regardless of what you name the repo. No manual edit needed here.
export default defineConfig({
  plugins: [react()],
  base: '/workout-tracker/',
});
