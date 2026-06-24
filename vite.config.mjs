import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// MedBoard Pro — Vite + React build.
// Outputs to dist/ (set as Netlify publish dir). Netlify Functions stay in netlify/functions
// and are unaffected by this build.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});
