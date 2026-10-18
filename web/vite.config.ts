import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // MapLibre ships a module worker next to its ESM entry; pre-bundling
    // breaks the worker URL in dev. Let Vite serve the package ESM directly.
    exclude: ["maplibre-gl"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": backend,
      "/media": backend,
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
  },
});
