import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
} from "maplibre-gl";

type FillValue = number | ExpressionSpecification;

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
