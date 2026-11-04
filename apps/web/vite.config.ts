import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        // Keep vendor code in stable, cacheable chunks and under Rollup's size warning.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          charts: ["recharts"],
          near: ["near-api-js", "near-connect-hooks", "@hot-labs/near-connect"],
        },
      },
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
