import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
} from "maplibre-gl";

type FillValue = number | ExpressionSpecification;

/**
 * Fill opacity for the province layer.
 *
 * Without a basemap the administrative shapes *are* the map, so they stay
 * solid. With a street basemap the fills must step back as the camera zooms
 * in, otherwise a 0.9 opacity wash hides the basemap and its labels exactly
 * where the user needs them (roughly zoom 8 to 12).
 */
export function provinceFillOpacity(
  withBasemap: boolean,
): DataDrivenPropertyValueSpecification<number> {
  const visited: FillValue = withBasemap
    ? ["interpolate", ["linear"], ["zoom"], 4, 0.9, 6, 0.62, 8, 0.32, 10, 0.14, 12, 0.03]
    : 0.9;
  const hover: FillValue = withBasemap
    ? ["interpolate", ["linear"], ["zoom"], 4, 0.92, 8, 0.5, 10, 0.24, 12, 0.12]
    : 0.92;
  const unvisited: FillValue = withBasemap
    ? ["interpolate", ["linear"], ["zoom"], 4, 0.8, 6, 0.5, 8, 0.24, 10, 0.1, 12, 0.02]
    : 0.82;

  return [
    "case",
    ["boolean", ["feature-state", "hover"], false],
    hover,
    ["boolean", ["get", "_visited"], false],
    visited,
    unvisited,
  ] as unknown as ExpressionSpecification;
}

/** City fills follow the same rule, ending at 0.06 so streets stay readable. */
export function cityFillOpacity(
  withBasemap: boolean,
): DataDrivenPropertyValueSpecification<number> {
  const visited: FillValue = withBasemap
    ? ["interpolate", ["linear"], ["zoom"], 5, 0.45, 6, 0.36, 8, 0.2, 10, 0.1, 12, 0.06]
    : 0.45;
  const hover: FillValue = withBasemap
    ? ["interpolate", ["linear"], ["zoom"], 5, 0.34, 8, 0.22, 10, 0.14, 12, 0.1]
    : 0.28;

  return [
    "case",
    ["boolean", ["get", "_municipality"], false],
    0,
    ["boolean", ["feature-state", "hover"], false],
    hover,
    ["boolean", ["get", "_visited"], false],
    visited,
    0,
  ] as unknown as ExpressionSpecification;
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
