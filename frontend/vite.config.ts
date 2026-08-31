import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 4000,
    strictPort: true,

    // Vite blocks unrecognized Host headers.
    allowedHosts: ["orviohub.localhost", ".orviohub.localhost"],

    // HMR websocket connects to port 4000
    hmr: { clientPort: 4000 },

    // Proxy the API to the backend server on port 3000
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        // Preserve the original Host header so backend resolves host context
        changeOrigin: false,
      },
    },
  },
});
