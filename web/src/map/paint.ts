import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
} from "maplibre-gl";
import type { Theme as MapTheme } from "../lib/theme";

type FillValue = number | string | ExpressionSpecification;

export interface MapPalette {
  background: string;
  province: string;
  provinceVisited: string;
  provinceHover: string;
  provinceLine: string;
  provinceLineVisited: string;
  city: string;
  cityHover: string;
  cityLine: string;
  place: string;
  placeSelected: string;
  route: string;
  routeHalo: string;
  cluster: string;
  markerStroke: string;
}

export const MAP_PALETTES: Record<MapTheme, MapPalette> = {
  light: {
    background: "#e8eef4",
    province: "#f8f7f5",
    provinceVisited: "#ffcdd2",
    provinceHover: "#ffeaf0",
    provinceLine: "#c6d0dd",
    provinceLineVisited: "#e9a8ba",
    city: "#f38caf",
    cityHover: "#f7b5cc",
    cityLine: "#bfcbd9",
    place: "#1877f2",
    placeSelected: "#f38caf",
    route: "#1877f2",
    routeHalo: "#ffffff",
    cluster: "#1877f2",
    markerStroke: "#ffffff",
  },
  dark: {
    background: "#0d1218",
    province: "#1a212b",
    provinceVisited: "#54303c",
    provinceHover: "#6b3a49",
    provinceLine: "#3a4757",
    provinceLineVisited: "#b06a82",
    city: "#b45d7a",
    cityHover: "#cf7d99",
    cityLine: "#3f4c5d",
    place: "#62a9ff",
    placeSelected: "#ff9ab7",
    route: "#62a9ff",
    routeHalo: "#0d1218",
    cluster: "#4f8fdd",
    markerStroke: "#161c25",
  },
};

export function mapPalette(theme: MapTheme = "light"): MapPalette {
  return MAP_PALETTES[theme];
}

function caseValue(
  hover: FillValue,
  visited: FillValue,
  unvisited: FillValue,
): ExpressionSpecification {
  return [
    "case",
    ["boolean", ["feature-state", "hover"], false],
    hover,
    ["boolean", ["get", "_visited"], false],
    visited,
    unvisited,
  ] as unknown as ExpressionSpecification;
}

export function provinceFillColor(
  theme: MapTheme = "light",
): DataDrivenPropertyValueSpecification<string> {
  const palette = mapPalette(theme);
  return caseValue(
    palette.provinceHover,
    palette.provinceVisited,
    palette.province,
  );
}

export function cityFillColor(
  theme: MapTheme = "light",
): DataDrivenPropertyValueSpecification<string> {
  const palette = mapPalette(theme);
  return [
    "case",
    ["boolean", ["get", "_visited"], false],
    palette.city,
    ["boolean", ["feature-state", "hover"], false],
    palette.cityHover,
    palette.city,
  ] as unknown as ExpressionSpecification;
}

/**
 * Fill opacity for the province layer.
 *
 * Without a basemap the administrative shapes *are* the map, so they stay
 * solid. With a street basemap the fills must step back as the camera zooms
 * in, otherwise a 0.9 opacity wash hides the basemap and its labels exactly
 * where the user needs them (roughly zoom 8 to 12).
 *
 * The style specification only allows a zoom expression as the input of a
 * top-level `interpolate`/`step`, so the hover/visited branches are the output
 * values of each stop rather than wrapping the interpolation in a `case`.
 */
export function provinceFillOpacity(
  withBasemap: boolean,
): DataDrivenPropertyValueSpecification<number> {
  if (!withBasemap) {
    return caseValue(0.92, 0.9, 0.82);
  }
  const expression: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["zoom"],
    4,
    caseValue(0.92, 0.9, 0.8),
    6,
    caseValue(0.66, 0.62, 0.5),
    8,
    caseValue(0.5, 0.32, 0.24),
    10,
    caseValue(0.24, 0.14, 0.1),
    12,
    caseValue(0.12, 0.03, 0.02),
    22,
    caseValue(0.12, 0.03, 0.02),
  ];
  return expression;
}

/** City fills follow the same rule, ending at 0.06 so streets stay readable. */
export function cityFillOpacity(
  withBasemap: boolean,
): DataDrivenPropertyValueSpecification<number> {
  const city = (visited: FillValue, hover: FillValue): ExpressionSpecification =>
    [
      "case",
      ["boolean", ["get", "_municipality"], false],
      0,
      ["boolean", ["feature-state", "hover"], false],
      hover,
      ["boolean", ["get", "_visited"], false],
      visited,
      0,
    ] as unknown as ExpressionSpecification;

  if (!withBasemap) {
    return city(0.45, 0.28);
  }
  const expression: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["zoom"],
    5,
    city(0.45, 0.34),
    6,
    city(0.36, 0.3),
    8,
    city(0.2, 0.22),
    10,
    city(0.1, 0.14),
    12,
    city(0.06, 0.1),
    22,
    city(0.06, 0.1),
  ];
  return expression;
}

/** Fill used by the admin location picker, which never draws footprint data. */
export function pickerFillOpacity(
  withBasemap: boolean,
): DataDrivenPropertyValueSpecification<number> {
  const expression: FillValue = withBasemap
    ? ["interpolate", ["linear"], ["zoom"], 4, 0.86, 6, 0.52, 8, 0.26, 10, 0.1, 12, 0.04]
    : 0.88;
  return expression;
}
