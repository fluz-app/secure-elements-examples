import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // server.js mints client tokens; see its own comment for why it's a
      // separate process from Vite's dev server.
      "/mint-token": "http://localhost:4201",
    },
  },
});
