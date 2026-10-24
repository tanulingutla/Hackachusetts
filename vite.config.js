import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Fixed address so the bookmark stays valid. strictPort fails loudly
    // instead of silently moving to another port if this one is taken.
    host: "localhost",
    port: 5174,
    strictPort: true,
    proxy: {
      // Forward /api calls to the local API server (npm run api).
      "/api": "http://127.0.0.1:8787",
    },
  },
});
