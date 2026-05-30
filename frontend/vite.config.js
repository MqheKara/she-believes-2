import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_API_BASE_URL is the SAME env var the frontend code uses at runtime.
// Here in vite.config.js it only affects the DEV server's proxy (i.e. when
// you run `npm run dev`). It has no effect on production builds — those
// are governed by the value of import.meta.env.VITE_API_BASE_URL baked in
// at build time on Render.
//
// Typical local setup: leave it unset so the proxy points at Flask on :5000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api":     { target: process.env.VITE_API_BASE_URL || "http://localhost:5000", changeOrigin: true },
      "/uploads": { target: process.env.VITE_API_BASE_URL || "http://localhost:5000", changeOrigin: true },
    },
  },
});
