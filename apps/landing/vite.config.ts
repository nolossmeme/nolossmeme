import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: true,
    rollupOptions: {
      // Two pages: the landing and /demo/.
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        demo: fileURLToPath(new URL("demo/index.html", import.meta.url)),
      },
      output: { manualChunks: { react: ["react", "react-dom", "@tanstack/react-query"] } },
    },
  },
});
