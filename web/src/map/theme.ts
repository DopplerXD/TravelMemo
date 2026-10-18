import type { Map as MapLibreMap } from "maplibre-gl";
import type { Theme as MapTheme } from "../lib/theme";
import { BASEMAP_LABEL_LAYER, BASEMAP_LAYER } from "./basemap";
import {
  cityFillColor,
  cityFillOpacity,
  mapPalette,
  provinceFillColor,
  provinceFillOpacity,
} from "./paint";

function setPaint(
  map: MapLibreMap,
  layer: string,
  property: Parameters<MapLibreMap["setPaintProperty"]>[1],
  value: unknown,
): void {
  if (!map.getLayer(layer)) return;
  try {
    map.setPaintProperty(layer, property, value as never);
  } catch {
    // A style swap can race with the theme update; style.load applies it again.
  }
}

/**
 * Updates every drawn color in place. The map instance, camera, selection and
 * data sources are never rebuilt, so switching themes keeps the current view.
 */
export function applyThemePaint(
  map: MapLibreMap,
  theme: MapTheme,
  withBasemap: boolean,
): void {
  const palette = mapPalette(theme);
  setPaint(map, "background", "background-color", palette.background);

  setPaint(map, "province-fill", "fill-color", provinceFillColor(theme));
  setPaint(map, "province-fill", "fill-opacity", provinceFillOpacity(withBasemap));
  setPaint(map, "province-line", "line-color", [
    "case",
    ["boolean", ["get", "_visited"], false],
    palette.provinceLineVisited,
    palette.provinceLine,
  ]);

  setPaint(map, "city-fill", "fill-color", cityFillColor(theme));
  setPaint(map, "city-fill", "fill-opacity", cityFillOpacity(withBasemap));
  setPaint(map, "city-line", "line-color", palette.cityLine);

  setPaint(map, "route-halo", "line-color", palette.routeHalo);
  setPaint(map, "route-line", "line-color", palette.route);
  setPaint(map, "route-stop", "circle-color", palette.markerStroke);
  setPaint(map, "route-stop", "circle-stroke-color", palette.route);

  setPaint(map, "place-halo", "circle-color", palette.placeSelected);
  setPaint(map, "places-points", "circle-color", [
    "case",
    ["==", ["get", "_selected"], true],
    palette.placeSelected,
    palette.place,
  ]);
  setPaint(map, "places-points", "circle-stroke-color", palette.markerStroke);
  setPaint(map, "places-clusters", "circle-color", palette.cluster);
  setPaint(map, "places-clusters", "circle-stroke-color", palette.markerStroke);

  setPaint(map, BASEMAP_LAYER, "raster-opacity", theme === "dark" ? 0.62 : 1);
  setPaint(
    map,
    BASEMAP_LABEL_LAYER,
    "raster-opacity",
    theme === "dark" ? 0.7 : 1,
  );
}
