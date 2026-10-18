import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Position,
} from "geojson";

export interface AdministrativeProperties {
  adcode: string | number;
  name: string;
  center?: [number, number] | number[];
  centroid?: [number, number] | number[];
  level?: string;
}

export type AdministrativeFeature = Feature<
  Geometry,
  AdministrativeProperties
>;
export type AdministrativeCollection = FeatureCollection<
  Geometry,
  AdministrativeProperties
>;

const provinceCache = new Map<string, Promise<AdministrativeCollection>>();
const cityCache = new Map<string, Promise<AdministrativeCollection>>();
let provincesPromise: Promise<AdministrativeCollection> | null = null;

export class GeoDataError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "GeoDataError";
    this.status = status;
  }
}

export function normalizeAdcode(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return raw;
  return raw.padStart(6, "0");
}

export function normalizeCenter(
  properties: AdministrativeProperties | GeoJsonProperties | null | undefined,
  feature?: AdministrativeFeature,
): [number, number] | null {
  if (properties) {
    const center = properties.center;
    if (Array.isArray(center) && center.length >= 2) {
      const lng = Number(center[0]);
      const lat = Number(center[1]);
      if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
    const centroid = properties.centroid;
    if (Array.isArray(centroid) && centroid.length >= 2) {
      const lng = Number(centroid[0]);
      const lat = Number(centroid[1]);
      if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
    }
  }
  if (feature) {
    const box = getGeometryBounds(feature.geometry);
    if (box) {
      return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    }
  }
  return null;
}

export function getGeometryBounds(
  geometry: Geometry | null | undefined,
): [number, number, number, number] | null {
  if (!geometry) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const visit = (position: Position): void => {
    const lng = Number(position[0]);
    const lat = Number(position[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  };

  const walk = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (
      coordinates.length >= 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      visit(coordinates as Position);
      return;
    }
    for (const item of coordinates) walk(item);
  };

  if (geometry.type === "GeometryCollection") {
    for (const item of geometry.geometries) {
      const box = getGeometryBounds(item);
      if (!box) continue;
      minLng = Math.min(minLng, box[0]);
      minLat = Math.min(minLat, box[1]);
      maxLng = Math.max(maxLng, box[2]);
      maxLat = Math.max(maxLat, box[3]);
    }
  } else {
    walk(geometry.coordinates);
  }

  if (!Number.isFinite(minLng)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

async function fetchCollection(url: string): Promise<AdministrativeCollection> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new GeoDataError("行政区数据加载失败，请检查网络后重试");
  }
  if (!response.ok) {
    throw new GeoDataError(
      response.status === 404
        ? "暂时缺少该地区的行政区数据"
        : "行政区数据加载失败，请稍后重试",
      response.status,
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new GeoDataError("行政区数据格式异常，请稍后重试", response.status);
  }
  if (
    !data ||
    typeof data !== "object" ||
    !("type" in data) ||
    (data as { type?: string }).type !== "FeatureCollection" ||
    !Array.isArray((data as { features?: unknown }).features)
  ) {
    throw new GeoDataError("行政区数据格式异常，请稍后重试", response.status);
  }
  return data as AdministrativeCollection;
}

function withNormalizedProperties(
  collection: AdministrativeCollection,
): AdministrativeCollection {
  return {
    ...collection,
    features: collection.features
      .filter((feature): feature is AdministrativeFeature => Boolean(feature?.geometry))
      .map((feature) => {
        const adcode = normalizeAdcode(feature.properties?.adcode);
        const name = String(feature.properties?.name ?? "").trim();
        return {
          ...feature,
          id: adcode || feature.id,
          properties: {
            ...feature.properties,
            adcode,
            name: name || adcode,
          },
        };
      })
      .filter((feature) => Boolean(feature.properties.adcode)),
  };
}

export function loadProvinces(force = false): Promise<AdministrativeCollection> {
  if (force) {
    provincesPromise = null;
    provinceCache.clear();
  }
  if (!provincesPromise) {
    provincesPromise = fetchCollection("/geo/provinces.json")
      .then(withNormalizedProperties)
      .catch((error: unknown) => {
        provincesPromise = null;
        throw error;
      });
  }
  return provincesPromise;
}

export function loadCities(
  provinceCode: string,
  force = false,
): Promise<AdministrativeCollection> {
  const code = normalizeAdcode(provinceCode);
  if (!code) return Promise.reject(new GeoDataError("缺少省份编码"));
  if (force) cityCache.delete(code);
  const cached = cityCache.get(code);
  if (cached) return cached;

  const promise = fetchCollection(`/geo/cities/${encodeURIComponent(code)}.json`)
    .then(withNormalizedProperties)
    .catch((error: unknown) => {
      cityCache.delete(code);
      throw error;
    });
  cityCache.set(code, promise);
  return promise;
}

export function provinceCodeOfPlace(place: {
  provinceCode?: string;
  cityCode?: string;
}): string {
  const province = normalizeAdcode(place.provinceCode);
  if (province) return province.slice(0, 2) + "0000";
  return normalizeAdcode(place.cityCode).slice(0, 2) + "0000";
}

export const MUNICIPALITY_CODES = new Set([
  "110000",
  "120000",
  "310000",
  "500000",
]);
