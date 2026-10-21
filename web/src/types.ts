export interface RouteCity {
  name: string;
  lng: number;
  lat: number;
}

export interface Trip {
  id: string;
  title: string;
  description: string;
  cityRoute: RouteCity[];
}

export interface Place {
  id: string;
  name: string;
  province: string;
  provinceCode: string;
  city: string;
  cityCode: string;
  lng: number;
  lat: number;
}

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  alt: string;
}

export interface Entry {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  placeId: string;
  tripId: string | null;
  body: string;
  photos: Photo[];
}

export type EntrySummary = Omit<Entry, "body">;

export interface Catalog {
  trips: Trip[];
  places: Place[];
  entries: EntrySummary[];
}

export interface SessionInfo {
  authenticated: boolean;
  csrfToken?: string;
}

/**
 * 运行时底图配置，来自 GET /api/map-config。
 * tiles / overlayTiles 为空表示未配置街道底图，此时只绘制本地行政区。
 */
export interface MapConfig {
  tiles: string[];
  overlayTiles: string[];
  attribution: string;
  maxZoom: number;
}

export type AdminTab = "entries" | "trips" | "places";

export interface PoiCandidate {
  id: string;
  name: string;
  address: string;
  district: string;
  lng: number;
  lat: number;
}
