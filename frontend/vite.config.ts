import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { getAllowedHosts } from "@orviohub/shared";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,

    // Dynamically generated from the central @orviohub/shared application registry
    allowedHosts: getAllowedHosts(),

    // HMR websocket connects to port 3000
    hmr: { clientPort: 3000 },

    // Proxy the API to the backend server on port 4000
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/v1": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
