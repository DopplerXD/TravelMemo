import type { LngLatBoundsLike, StyleSpecification } from "maplibre-gl";
import type { Theme } from "../lib/theme";
import { mapPalette } from "./paint";

export const CHINA_VIEW_BOUNDS: LngLatBoundsLike = [
  [73.2, 18.1],
  [135.2, 53.7],
];

/**
 * Soft pan limit: the camera centre stays over China so the map never becomes
 * a world browser, without letting `maxBounds` force a higher zoom than the
 * padded national fit needs (which would crop Xinjiang or Heilongjiang).
 */
export const CHINA_PAN_BOUNDS = {
  west: 72,
  east: 138,
  south: 6,
  north: 54,
};

/** Extra zoom the user may pull back past the national fit, never to a world view. */
export const CHINA_ZOOM_OUT_STEPS = 0.6;

/**
 * Optional full MapLibre style URL for a vector basemap. When it is empty the
 * map starts from the local administrative view and, if the API provides one,
 * layers the runtime raster basemap on top.
 */
export const MAP_STYLE_URL = (import.meta.env.VITE_MAP_STYLE_URL ?? "").trim();

export function localStyle(theme: Theme = "light"): StyleSpecification {
  return {
    version: 8,
    name: "TravelMemo · 本地行政区底图",
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": mapPalette(theme).background },
      },
    ],
  };
}

export const LOCAL_STYLE = localStyle("light");
