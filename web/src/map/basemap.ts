import type { Map as MapLibreMap } from "maplibre-gl";
import { AttributionControl, type RasterTileSource } from "maplibre-gl";
import type { MapConfig } from "../types";

export const BASEMAP_SOURCE = "basemap";
export const BASEMAP_LABEL_SOURCE = "basemap-labels";
const BASEMAP_LAYER = "basemap";
const BASEMAP_LABEL_LAYER = "basemap-labels";

/** The layer the basemap has to sit underneath, so footprint fills stay on top. */
const BELOW_LAYER = "province-fill";

interface AppliedState {
  tiles: string;
  overlayTiles: string;
  attribution: string;
  control: AttributionControl | null;
}

const applied = new WeakMap<MapLibreMap, AppliedState>();

export function basemapConfigured(config: MapConfig | null | undefined): boolean {
  return Boolean(config && config.tiles.length > 0);
}

function clampMaxZoom(maxZoom: number): number {
  if (!Number.isFinite(maxZoom)) return 18;
  return Math.min(22, Math.max(1, maxZoom));
}

function ensureRasterSource(
  map: MapLibreMap,
  id: string,
  tiles: string[],
  maxZoom: number,
): RasterTileSource | null {
  const existing = map.getSource(id) as RasterTileSource | undefined;
  if (existing) {
    if (existing.tiles?.join("|") !== tiles.join("|")) existing.setTiles(tiles);
    return existing;
  }
  map.addSource(id, {
    type: "raster",
    tiles,
    tileSize: 256,
    minzoom: 0,
    maxzoom: clampMaxZoom(maxZoom),
  });
  return (map.getSource(id) as RasterTileSource | undefined) ?? null;
}

function addRasterLayer(
  map: MapLibreMap,
  id: string,
  opacity: number,
  belowLayer: string,
): void {
  if (map.getLayer(id)) return;
  const before = map.getLayer(belowLayer) ? belowLayer : undefined;
  map.addLayer(
    {
      id,
      type: "raster",
      source: id,
      paint: {
        "raster-opacity": opacity,
        "raster-fade-duration": 220,
      },
    },
    before,
  );
}

/**
 * Applies the runtime basemap configuration (vector basemap tiles plus an
 * optional annotation overlay) to an already created map. This is intentionally
 * additive rather than a `setStyle` call: the administrative layers, markers
 * and any in-flight data updates survive untouched.
 */
export function applyMapConfig(
  map: MapLibreMap,
  config: MapConfig | null,
  belowLayer: string = BELOW_LAYER,
): boolean {
  const tiles = config?.tiles.filter(Boolean) ?? [];
  if (tiles.length === 0) {
    return false;
  }
  const overlayTiles = config?.overlayTiles.filter(Boolean) ?? [];
  const attribution = config?.attribution?.trim() ?? "";
  const maxZoom = clampMaxZoom(config?.maxZoom ?? 18);

  const previous = applied.get(map);

  ensureRasterSource(map, BASEMAP_SOURCE, tiles, maxZoom);
  addRasterLayer(map, BASEMAP_LAYER, 1, belowLayer);

  if (overlayTiles.length > 0) {
    ensureRasterSource(map, BASEMAP_LABEL_SOURCE, overlayTiles, maxZoom);
    addRasterLayer(map, BASEMAP_LABEL_LAYER, 1, belowLayer);
  } else if (map.getLayer(BASEMAP_LABEL_LAYER)) {
    map.removeLayer(BASEMAP_LABEL_LAYER);
    if (map.getSource(BASEMAP_LABEL_SOURCE)) map.removeSource(BASEMAP_LABEL_SOURCE);
  }

  let control = previous?.control ?? null;
  if (control && previous?.attribution !== attribution) {
    map.removeControl(control);
    control = null;
  }
  if (!control && attribution) {
    control = new AttributionControl({ compact: true, customAttribution: attribution });
    map.addControl(control, "bottom-right");
  }

  applied.set(map, {
    tiles: tiles.join("|"),
    overlayTiles: overlayTiles.join("|"),
    attribution,
    control,
  });
  return true;
}

export function releaseMapConfig(map: MapLibreMap): void {
  applied.delete(map);
}
