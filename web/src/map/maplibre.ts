import { setWorkerUrl } from "maplibre-gl";
// MapLibre GL 6 derives the worker location from `import.meta.url` at runtime.
// Once the app is bundled that points into the hashed asset directory, where no
// worker file exists, so tiling silently fails and no vector layer is drawn.
// Importing the packaged worker with `?url` makes Vite emit it as a real asset
// (including its own module graph) and returns the final URL to hand back.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(workerUrl);

export * from "maplibre-gl";
