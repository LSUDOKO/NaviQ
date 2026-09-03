import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
  // Plotly and Leaflet dominate the bundle. Left unsplit deliberately: the demo
  // is served from localhost, and manual chunking is not worth the build-config
  // churn here. Split these out before any real deployment.
  build: { chunkSizeWarningLimit: 5000 },
});
