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
    port: 3000,
    strictPort: true,

    // Vite blocks unrecognized Host headers.
    allowedHosts: [
      "orviohub.localhost",
      ".orviohub.localhost",
      "account.orviohub.localhost",
      "accounts.orviohub.localhost",
      "home.orviohub.localhost",
      "app.orviohub.localhost",
      "inventory.orviohub.localhost",
      "pos.orviohub.localhost",
      "billing.orviohub.localhost",
      "taskmanagement.orviohub.localhost",
    ],

    // HMR websocket connects to port 3000
    hmr: { clientPort: 3000 },

    // Proxy the API to the backend server on port 4000
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
