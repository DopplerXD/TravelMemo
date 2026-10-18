import { setWorkerUrl } from "maplibre-gl";
// MapLibre resolves its worker relative to `import.meta.url`, which points into
// the hashed asset directory after bundling. Emit the packaged worker as an
// explicit asset and register the resulting URL instead.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

setWorkerUrl(workerUrl);

export * from "maplibre-gl";
