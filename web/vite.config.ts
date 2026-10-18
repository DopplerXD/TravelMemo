import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backend = "http://127.0.0.1:8015";

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
    rollupOptions: {
      output: {
        // Keep the map engine in its own long-lived vendor chunk so the app
        // entry stays small and MapLibre can be cached across deploys.
        manualChunks(id: string) {
          if (
            id.includes("node_modules/maplibre-gl/") ||
            id.includes("node_modules/@maplibre/") ||
            id.includes("node_modules/@mapbox/") ||
            id.includes("node_modules/geojson-vt/") ||
            id.includes("node_modules/supercluster/") ||
            id.includes("node_modules/gl-matrix/") ||
            id.includes("node_modules/earcut/") ||
            id.includes("node_modules/vt-pbf/") ||
            id.includes("node_modules/pbf/")
          ) {
            return "maplibre";
          }
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react";
          }
          return undefined;
        },
      },
    },
  },
});
