import type { LayerSpecification, SourceSpecification } from "maplibre-gl";
import type { Theme as MapTheme } from "../lib/theme";
import { cityFillColor, cityFillOpacity, mapPalette, provinceFillColor, provinceFillOpacity } from "./paint";

/** Zoom at which city boundaries start drawing. */
export const CITY_FILL_MIN_ZOOM = 4.9;

/**
 * Empty GeoJSON sources for the footprint overlays. They live next to the
 * layers that read them so the complete overlay style can be validated
 * against the MapLibre style specification without a browser.
 */
export const OVERLAY_SOURCES: Record<string, SourceSpecification> = {
  provinces: {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    promoteId: "adcode",
  },
  cities: {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    promoteId: "adcode",
  },
  route: {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  },
  places: {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterRadius: 46,
    clusterMaxZoom: 12,
    clusterProperties: {
      entries: ["+", ["get", "entryCount"]],
    },
  },
};

export function buildOverlayLayers(
  withBasemap: boolean,
  theme: MapTheme = "light",
): LayerSpecification[] {
  const palette = mapPalette(theme);
  return [
    {
      id: "province-fill",
      type: "fill",
      source: "provinces",
      paint: {
        "fill-color": provinceFillColor(theme),
        "fill-opacity": provinceFillOpacity(withBasemap),
      },
    },
    {
      id: "province-line",
      type: "line",
      source: "provinces",
      paint: {
        "line-color": [
          "case",
          ["boolean", ["get", "_visited"], false],
          palette.provinceLineVisited,
          palette.provinceLine,
        ],
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 7, 1.3],
        "line-opacity": 0.9,
      },
    },
    {
      id: "city-fill",
      type: "fill",
      source: "cities",
      minzoom: CITY_FILL_MIN_ZOOM,
      paint: {
        "fill-color": cityFillColor(theme),
        "fill-opacity": cityFillOpacity(withBasemap),
      },
    },
    {
      id: "city-line",
      type: "line",
      source: "cities",
      minzoom: CITY_FILL_MIN_ZOOM,
      paint: {
        "line-color": palette.cityLine,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.45, 9, 0.9],
        "line-opacity": 0.72,
      },
    },
    {
      id: "route-halo",
      type: "line",
      source: "route",
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": palette.routeHalo,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 3.5, 10, 7],
        "line-opacity": 0.65,
      },
    },
    {
      id: "route-line",
      type: "line",
      source: "route",
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": palette.route,
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.6, 10, 3],
        "line-dasharray": [1.6, 1.2],
        "line-opacity": 0.9,
      },
    },
    {
      id: "route-stop",
      type: "circle",
      source: "route",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 5, 10, 7],
        "circle-color": palette.markerStroke,
        "circle-stroke-color": palette.route,
        "circle-stroke-width": 2.4,
      },
    },
    {
      id: "place-halo",
      type: "circle",
      source: "places",
      filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "_selected"], true]],
      paint: {
        "circle-radius": 15,
        "circle-color": palette.placeSelected,
        "circle-opacity": 0.24,
      },
    },
    {
      id: "places-points",
      type: "circle",
      source: "places",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4.2, 10, 6.4],
        "circle-color": [
          "case",
          ["==", ["get", "_selected"], true],
          palette.placeSelected,
          palette.place,
        ],
        "circle-stroke-color": palette.markerStroke,
        "circle-stroke-width": 2,
        "circle-opacity": 1,
      },
    },
    {
      id: "places-clusters",
      type: "circle",
      source: "places",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": palette.cluster,
        "circle-opacity": 0.92,
        "circle-stroke-color": palette.markerStroke,
        "circle-stroke-width": 2.4,
        "circle-radius": [
          "step",
          ["get", "point_count"],
          14,
          4,
          18,
          10,
          23,
          25,
          28,
        ],
      },
    },
  ];
}
