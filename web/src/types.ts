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

export type AdminTab = "entries" | "trips" | "places";
