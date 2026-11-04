import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: true,
    rollupOptions: {
      output: { manualChunks: { react: ["react", "react-dom", "@tanstack/react-query"] } },
    },
  },
});
