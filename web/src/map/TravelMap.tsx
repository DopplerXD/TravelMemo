import {
  Map as MapLibreMap,
  Marker,
  Point as MlPoint,
  Popup,
  type ErrorEvent as MapErrorEvent,
  type GeoJSONFeature,
  type GeoJSONSource,
  type LayerSpecification,
  type MapGeoJSONFeature,
  type MapMouseEvent,
  type MapSourceDataEvent,
} from "./maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Feature, FeatureCollection, Geometry, LineString, Point as GeoPoint } from "geojson";
import {
  getGeometryBounds,
  loadCities,
  loadProvinces,
  MUNICIPALITY_CODES,
  normalizeAdcode,
  normalizeCenter,
  type AdministrativeCollection,
  type AdministrativeFeature,
  type AdministrativeProperties,
} from "../lib/geo";
import type { EntrySummary, Place, RouteCity, Trip } from "../types";
import { ErrorState } from "../components/States";
import { Spinner } from "../components/Spinner";
import { ResetIcon } from "../icons";
import {
  CHINA_PAN_BOUNDS,
  CHINA_VIEW_BOUNDS,
  CHINA_ZOOM_OUT_STEPS,
  localStyle,
  MAP_STYLE_URL,
} from "./mapStyle";
import { applyMapConfig, basemapConfigured, BASEMAP_LABEL_SOURCE, BASEMAP_SOURCE, releaseMapConfig } from "./basemap";
import { cityFillOpacity, provinceFillOpacity } from "./paint";
import { buildOverlayLayers, OVERLAY_SOURCES } from "./layers";
import { useMapConfig } from "../lib/useMapConfig";
import { mapDuration } from "../lib/motion";
import type { Theme } from "../lib/theme";
import { applyThemePaint } from "./theme";

const CITY_LOAD_ZOOM = 5;
const CITY_LABEL_VISITED_ZOOM = 5.2;
const CITY_LABEL_ALL_ZOOM = 6.4;
const SELECTED_ZOOM = 12.4;

type AdminFeature = Feature<
  Geometry,
  AdministrativeProperties & { _visited?: boolean; _municipality?: boolean }
>;
type AdminCollection = FeatureCollection<
  Geometry,
  AdministrativeProperties & { _visited?: boolean; _municipality?: boolean }
>;

interface PlaceFeatureProperties {
  placeId: string;
  name: string;
  entryCount: number;
  _selected: boolean;
}

type PlaceCollection = FeatureCollection<GeoPoint, PlaceFeatureProperties>;
type RouteCollection = FeatureCollection<LineString | GeoPoint, { name?: string; index?: number }>;

export type MapPanelLayout = "none" | "left" | "center";

export interface TravelMapHandle {
  focusPlace: (place: Place) => void;
  focusRoute: (cities: RouteCity[]) => void;
  resetView: () => void;
}

export interface TravelMapProps {
  places: Place[];
  entries: EntrySummary[];
  visitedProvinceCodes: Set<string>;
  visitedCityCodes: Set<string>;
  selectedPlace: Place | null;
  activeTrip: Trip | null;
  /** Right-hand detail panel is open, so the national fit must leave room for it. */
  detailOpen?: boolean;
  /** Which floating panel currently owns map space. */
  panelLayout?: MapPanelLayout;
  theme: Theme;
  onSelectPlace: (placeId: string) => void;
  onClearSelection: () => void;
}

function toAdminCollection(
  collections: AdministrativeCollection[],
  visited: Set<string>,
  options: { city?: boolean } = {},
): AdminCollection {
  const features: AdminFeature[] = [];
  for (const collection of collections) {
    for (const feature of collection.features) {
      const adcode = normalizeAdcode(feature.properties?.adcode);
      if (!adcode) continue;
      const municipality = MUNICIPALITY_CODES.has(adcode);
      features.push({
        ...feature,
        id: adcode,
        properties: {
          ...feature.properties,
          adcode,
          _visited: visited.has(adcode),
          _municipality: Boolean(options.city && municipality),
        },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function placeCollection(
  places: Place[],
  entries: EntrySummary[],
  selectedPlaceId: string | null,
): PlaceCollection {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.placeId, (counts.get(entry.placeId) ?? 0) + 1);
  }
  return {
    type: "FeatureCollection",
    features: places
      .filter(
        (place) =>
          Number.isFinite(place.lng) &&
          Number.isFinite(place.lat) &&
          place.lng >= -180 &&
          place.lng <= 180 &&
          place.lat >= -90 &&
          place.lat <= 90,
      )
      .map((place) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [place.lng, place.lat] },
        properties: {
          placeId: place.id,
          name: place.name,
          entryCount: counts.get(place.id) ?? 0,
          _selected: place.id === selectedPlaceId,
        },
      })),
  };
}

function routeCollection(trip: Trip | null): RouteCollection {
  if (!trip) return { type: "FeatureCollection", features: [] };
  const cities = trip.cityRoute.filter(
    (city) => Number.isFinite(city.lng) && Number.isFinite(city.lat),
  );
  const features: RouteCollection["features"] = cities.map((city, index) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [city.lng, city.lat] },
    properties: { name: city.name, index: index + 1 },
  }));
  if (cities.length > 1) {
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: cities.map((city) => [city.lng, city.lat]),
      },
      properties: {},
    });
  }
  return { type: "FeatureCollection", features };
}

function propString(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function propNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function queryFeatures(
  map: MapLibreMap,
  point: MlPoint,
  layerIds: string[],
): MapGeoJSONFeature[] {
  const existing = layerIds.filter((id) => Boolean(map.getLayer(id)));
  if (existing.length === 0) return [];
  try {
    return map.queryRenderedFeatures(point, { layers: existing });
  } catch {
    return [];
  }
}

function clearHoverState(map: MapLibreMap, source: string, ids: Set<string | number>): void {
  for (const id of ids) {
    try {
      map.setFeatureState({ source, id }, { hover: false });
    } catch {
      // The source may have been replaced by a style update.
    }
  }
  ids.clear();
}

function ensureLayer(map: MapLibreMap, layer: LayerSpecification): void {
  if (!map.getLayer(layer.id)) map.addLayer(layer);
}

function addOverlayLayers(
  map: MapLibreMap,
  withBasemap: boolean,
  theme: Theme,
): void {
  for (const [id, spec] of Object.entries(OVERLAY_SOURCES)) {
    if (!map.getSource(id)) map.addSource(id, spec);
  }
  for (const layer of buildOverlayLayers(withBasemap, theme)) ensureLayer(map, layer);
}

function syncFillOpacity(map: MapLibreMap, withBasemap: boolean): void {
  try {
    if (map.getLayer("province-fill")) {
      map.setPaintProperty("province-fill", "fill-opacity", provinceFillOpacity(withBasemap));
    }
    if (map.getLayer("city-fill")) {
      map.setPaintProperty("city-fill", "fill-opacity", cityFillOpacity(withBasemap));
    }
  } catch {
    // A style swap can race with this call; the next style.load retries.
  }
}

function createLabel(text: string, className: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = `map-label ${className}`;
  element.textContent = text;
  return element;
}

function createPinLabel(text: string): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "map-selected-pin";
  const name = document.createElement("span");
  name.className = "map-selected-pin__name";
  name.textContent = text;
  const stem = document.createElement("span");
  stem.className = "map-selected-pin__stem";
  element.append(name, stem);
  return element;
}

function createRouteStop(order: number): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "map-route-stop";
  element.textContent = String(order);
  return element;
}

function createClusterBadge(count: number): HTMLDivElement {
  const element = document.createElement("div");
  element.className = "map-cluster-badge";
  element.textContent = String(count);
  return element;
}

type MapPadding = { top: number; right: number; bottom: number; left: number };

/**
 * Padding for the national fit, measured from the live viewport so the nav,
 * the active panel and the mobile bottom bar never cover the country. A pure
 * map reserves no legacy sidebar space.
 */
function computeFitPadding(
  panelLayout: MapPanelLayout,
  detailOpen: boolean,
): MapPadding {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width <= 759) {
    return { top: 76, right: 16, bottom: height >= 760 ? 156 : 146, left: 16 };
  }
  const compact = width <= 1120;
  const sideSpace = compact ? 352 : 404;
  const detailSpace = compact ? 360 : 420;
  return {
    top: 96,
    right: detailOpen ? detailSpace : 28,
    bottom: 88,
    left: panelLayout === "left" ? sideSpace : 28,
  };
}

export const TravelMap = forwardRef<TravelMapHandle, TravelMapProps>(
  function TravelMap(
    {
      places,
      entries,
      visitedProvinceCodes,
      visitedCityCodes,
      selectedPlace,
      activeTrip,
      detailOpen = false,
      panelLayout = "none",
      theme,
      onSelectPlace,
      onClearSelection,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const popupRef = useRef<Popup | null>(null);
    const hoverProvinceRef = useRef<Set<string | number>>(new Set());
    const hoverCityRef = useRef<Set<string | number>>(new Set());
    const provinceMarkersRef = useRef<Array<{ marker: Marker; element: HTMLElement }>>([]);
    const cityMarkersRef = useRef<
      Array<{ marker: Marker; element: HTMLElement; center: [number, number]; visited: boolean }>
    >([]);
    const selectedMarkerRef = useRef<Marker | null>(null);
    const routeMarkersRef = useRef<Marker[]>([]);
    const clusterMarkersRef = useRef<Map<string, { marker: Marker; element: HTMLElement; count: number }>>(
      new Map(),
    );
    const loadedCityRef = useRef<Set<string>>(new Set());
    const loadingCityRef = useRef<Set<string>>(new Set());
    const failedCityRef = useRef<Set<string>>(new Set());
    const initialFitRef = useRef(false);
    const styleFallbackRef = useRef(false);
    const userMovedRef = useRef(false);
    const detailOpenRef = useRef(detailOpen);
    detailOpenRef.current = detailOpen;
    const panelLayoutRef = useRef(panelLayout);
    panelLayoutRef.current = panelLayout;
    const themeRef = useRef(theme);
    themeRef.current = theme;

    const [provinces, setProvinces] = useState<AdministrativeCollection | null>(null);
    const [provinceError, setProvinceError] = useState<string | null>(null);
    const [provinceLoading, setProvinceLoading] = useState(true);
    const [provinceVersion, setProvinceVersion] = useState(0);
    const [cityCollections, setCityCollections] = useState<Record<string, AdministrativeCollection>>(
      {},
    );
    const [cityErrors, setCityErrors] = useState(0);
    const [mapReady, setMapReady] = useState(false);
    const [styleEpoch, setStyleEpoch] = useState(0);
    const [mapZoom, setMapZoom] = useState(3.6);
    const [cityLoading, setCityLoading] = useState(false);
    const [basemapError, setBasemapError] = useState(false);
    const [basemapVersion, setBasemapVersion] = useState(0);

    const { config: mapConfig, error: mapConfigError, retry: retryMapConfig } = useMapConfig();
    const withBasemap = basemapConfigured(mapConfig);
    const withBasemapRef = useRef(withBasemap);
    withBasemapRef.current = withBasemap;
    const dataRef = useRef({
      provinceData: null as AdminCollection | null,
      cityData: null as AdminCollection | null,
      placesData: { type: "FeatureCollection", features: [] } as PlaceCollection,
      routeData: { type: "FeatureCollection", features: [] } as RouteCollection,
    });

    const handlersRef = useRef({ onSelectPlace, onClearSelection });
    handlersRef.current = { onSelectPlace, onClearSelection };

    /**
     * Frames the whole country inside the area that no floating panel covers.
     * The zoom is computed with `cameraForBounds` instead of `fitBounds` so the
     * minimum allowed zoom can follow the padded fit; a fixed minZoom or
     * `maxBounds` would otherwise clamp the camera and crop Xinjiang,
     * Heilongjiang or Taiwan on small viewports.
     */
    const fitChina = useCallback((map: MapLibreMap, duration: number) => {
      const camera = map.cameraForBounds(CHINA_VIEW_BOUNDS, {
        padding: computeFitPadding(panelLayoutRef.current, detailOpenRef.current),
        maxZoom: 4.9,
      });
      if (!camera) return;
      const zoom = typeof camera.zoom === "number" ? camera.zoom : map.getZoom();
      map.setMinZoom(Math.max(1.2, zoom - CHINA_ZOOM_OUT_STEPS));
      map.easeTo({
        center: camera.center,
        zoom,
        duration: mapDuration(duration),
        essential: true,
      });
    }, []);

    useEffect(() => {
      let cancelled = false;
      setProvinceLoading(true);
      setProvinceError(null);
      loadProvinces(provinceVersion > 0)
        .then((data) => {
          if (!cancelled) setProvinces(data);
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setProvinceError(
              error instanceof Error ? error.message : "行政区数据加载失败，请重试",
            );
          }
        })
        .finally(() => {
          if (!cancelled) setProvinceLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [provinceVersion]);

    const provinceData = useMemo(
      () => (provinces ? toAdminCollection([provinces], visitedProvinceCodes) : null),
      [provinces, visitedProvinceCodes],
    );

    const cityData = useMemo(() => {
      const collections = Object.values(cityCollections);
      if (collections.length === 0) return null;
      return toAdminCollection(collections, visitedCityCodes, { city: true });
    }, [cityCollections, visitedCityCodes]);

    const placesData = useMemo(
      () => placeCollection(places, entries, selectedPlace?.id ?? null),
      [places, entries, selectedPlace?.id],
    );

    const routeData = useMemo(() => routeCollection(activeTrip), [activeTrip]);

    dataRef.current = { provinceData, cityData, placesData, routeData };

    const loadProvince = useCallback((provinceCode: string) => {
      const code = normalizeAdcode(provinceCode);
      if (!code) return;
      if (loadedCityRef.current.has(code) || loadingCityRef.current.has(code)) return;
      if (failedCityRef.current.has(code)) return;
      loadingCityRef.current.add(code);
      setCityLoading(true);
      loadCities(code)
        .then((collection) => {
          loadedCityRef.current.add(code);
          setCityCollections((current) => ({ ...current, [code]: collection }));
        })
        .catch(() => {
          failedCityRef.current.add(code);
          setCityErrors((value) => value + 1);
        })
        .finally(() => {
          loadingCityRef.current.delete(code);
          if (loadingCityRef.current.size === 0) setCityLoading(false);
        });
    }, []);

    const loadVisibleCities = useCallback(() => {
      const map = mapRef.current;
      // Do not gate on `isStyleLoaded()`: it reports false while *any* source is
      // still streaming, which would permanently skip city loading on a cold
      // start. Layer presence plus a guarded query is enough here.
      if (!map || map.getZoom() < CITY_LOAD_ZOOM) return;
      if (!map.getLayer("province-fill")) return;
      let features: MapGeoJSONFeature[] = [];
      try {
        features = map.queryRenderedFeatures({ layers: ["province-fill"] });
      } catch {
        return;
      }
      const codes = new Set<string>();
      for (const feature of features) {
        const code = normalizeAdcode(feature.properties?.adcode as string | number | undefined);
        if (code) codes.add(code);
        if (codes.size >= 10) break;
      }
      for (const code of codes) loadProvince(code);
    }, [loadProvince]);

    const updateLabelVisibility = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      const provinceOpacity = Math.max(0, Math.min(1, (6.9 - zoom) / 1.4));
      for (const { element } of provinceMarkersRef.current) {
        element.style.opacity = provinceOpacity.toFixed(2);
        element.style.visibility = provinceOpacity > 0.02 ? "visible" : "hidden";
      }

      let shownUnvisited = 0;
      for (const item of cityMarkersRef.current) {
        const inView = bounds.contains(item.center);
        const shouldShow =
          inView &&
          zoom >= (item.visited ? CITY_LABEL_VISITED_ZOOM : CITY_LABEL_ALL_ZOOM) &&
          (!item.visited ? shownUnvisited++ < 120 : true);
        item.element.style.opacity = shouldShow ? "1" : "0";
        item.element.style.visibility = shouldShow ? "visible" : "hidden";
      }
    }, []);

    const updateClusterBadges = useCallback(() => {
      const map = mapRef.current;
      if (!map || !map.getSource("places")) return;
      let features: GeoJSONFeature[] = [];
      try {
        features = map.querySourceFeatures("places", {
          filter: ["has", "point_count"],
        });
      } catch {
        return;
      }
      const next = new Map<string, { lng: number; lat: number; count: number }>();
      for (const feature of features) {
        const id = feature.properties?.cluster_id;
        if (id === undefined || id === null) continue;
        const key = String(id);
        if (next.has(key)) continue;
        const geometry = feature.geometry;
        if (geometry.type !== "Point") continue;
        const [lng, lat] = geometry.coordinates;
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        next.set(key, {
          lng: lng as number,
          lat: lat as number,
          count: propNumber(feature.properties?.point_count),
        });
      }

      for (const [key, item] of clusterMarkersRef.current) {
        if (!next.has(key)) {
          item.marker.remove();
          clusterMarkersRef.current.delete(key);
        }
      }

      for (const [key, value] of next) {
        const existing = clusterMarkersRef.current.get(key);
        if (existing) {
          existing.marker.setLngLat([value.lng, value.lat]);
          if (existing.count !== value.count) {
            existing.element.textContent = String(value.count);
            existing.count = value.count;
          }
        } else {
          const element = createClusterBadge(value.count);
          const marker = new Marker({ element, anchor: "center" })
            .setLngLat([value.lng, value.lat])
            .addTo(map);
          clusterMarkersRef.current.set(key, { marker, element, count: value.count });
        }
      }
    }, []);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const useExternalStyle = Boolean(MAP_STYLE_URL);
      const map = new MapLibreMap({
        container,
        style: useExternalStyle ? MAP_STYLE_URL : localStyle(themeRef.current),
        center: [104.2, 35.6],
        zoom: 3.6,
        minZoom: 1.4,
        maxZoom: 17,
        renderWorldCopies: false,
        attributionControl: useExternalStyle ? { compact: true } : false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      mapRef.current = map;

      map.on("style.load", () => {
        setStyleEpoch((value) => value + 1);
        setMapReady(true);
        applyThemePaint(map, themeRef.current, withBasemapRef.current);
        if (!initialFitRef.current) {
          initialFitRef.current = true;
          fitChina(map, 0);
        }
      });

      map.on("error", (event: MapErrorEvent) => {
        const detail = event as unknown as {
          error?: { message?: string };
          sourceId?: string;
        };
        const message = String(detail.error?.message ?? "");
        if (
          !useExternalStyle &&
          (detail.sourceId === BASEMAP_SOURCE ||
            detail.sourceId === BASEMAP_LABEL_SOURCE ||
            /tile|basemap/i.test(message))
        ) {
          setBasemapError(true);
        }
        if (
          useExternalStyle &&
          !styleFallbackRef.current &&
          !map.isStyleLoaded() &&
          /style|sprite|glyph|source|load/i.test(message)
        ) {
          styleFallbackRef.current = true;
          map.setStyle(localStyle(themeRef.current));
        }
      });

      return () => {
        popupRef.current?.remove();
        popupRef.current = null;
        for (const { marker } of provinceMarkersRef.current) marker.remove();
        provinceMarkersRef.current = [];
        for (const { marker } of cityMarkersRef.current) marker.remove();
        cityMarkersRef.current = [];
        for (const marker of routeMarkersRef.current) marker.remove();
        routeMarkersRef.current = [];
        selectedMarkerRef.current?.remove();
        selectedMarkerRef.current = null;
        for (const { marker } of clusterMarkersRef.current.values()) marker.remove();
        clusterMarkersRef.current.clear();
        releaseMapConfig(map);
        map.remove();
        mapRef.current = null;
        setMapReady(false);
      };
    }, [fitChina]);

    const applyOverlayData = useCallback(() => {
      const map = mapRef.current;
      if (!map) return false;
      try {
        addOverlayLayers(map, withBasemapRef.current, themeRef.current);
        syncFillOpacity(map, withBasemapRef.current);
        applyThemePaint(map, themeRef.current, withBasemapRef.current);

        const data = dataRef.current;
        (map.getSource("provinces") as GeoJSONSource | undefined)?.setData(
          data.provinceData ?? { type: "FeatureCollection", features: [] },
        );
        (map.getSource("cities") as GeoJSONSource | undefined)?.setData(
          data.cityData ?? { type: "FeatureCollection", features: [] },
        );
        (map.getSource("places") as GeoJSONSource | undefined)?.setData(data.placesData);
        (map.getSource("route") as GeoJSONSource | undefined)?.setData(data.routeData);
        return true;
      } catch {
        return false;
      }
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      if (!applyOverlayData()) {
        // The style is still being torn down or rebuilt: retry once it settles
        // instead of silently dropping this data update.
        const retry = (): void => {
          applyOverlayData();
          updateClusterBadges();
        };
        map.once("style.load", retry);
        return () => {
          map.off("style.load", retry);
        };
      }

      const timer = window.setTimeout(updateClusterBadges, 60);
      return () => window.clearTimeout(timer);
    }, [
      mapReady,
      styleEpoch,
      provinceData,
      cityData,
      placesData,
      routeData,
      applyOverlayData,
      updateClusterBadges,
    ]);

    // Load the runtime basemap (vector tiles + annotation overlay) once the
    // style is live, and re-apply it after a style swap or a manual retry.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady || MAP_STYLE_URL) return;
      try {
        if (!basemapConfigured(mapConfig)) return;
        const applied = applyMapConfig(
          map,
          mapConfig,
          undefined,
          themeRef.current,
        );
        if (applied) setBasemapError(false);
        syncFillOpacity(map, applied || withBasemap);
        applyThemePaint(map, themeRef.current, applied || withBasemap);
      } catch {
        setBasemapError(true);
      }
    }, [mapReady, styleEpoch, mapConfig, basemapVersion, withBasemap]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      applyThemePaint(map, theme, withBasemapRef.current);
      syncFillOpacity(map, withBasemapRef.current);
    }, [theme, mapReady, styleEpoch, withBasemap]);

    useEffect(() => {
      if (!mapReady) return;
      const map = mapRef.current;
      if (!map) return;
      if (!userMovedRef.current) fitChina(map, 320);
      updateLabelVisibility();
    }, [panelLayout, detailOpen, mapReady, fitChina, updateLabelVisibility]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      const onMove = (): void => {
        setMapZoom(map.getZoom());
        updateLabelVisibility();
      };
      const onMoveStart = (event: { originalEvent?: unknown }): void => {
        // Only real user gestures (drag, wheel, pinch) opt out of automatic
        // re-fitting; programmatic flies still count as browsing too once the
        // view has been deliberately changed.
        if (event.originalEvent) userMovedRef.current = true;
      };
      const onMoveEnd = (): void => {
        updateLabelVisibility();
        updateClusterBadges();
        loadVisibleCities();
        // Keep the camera over China without a hard `maxBounds` clamp, which
        // would force a higher zoom on small or padded viewports.
        const center = map.getCenter();
        const lng = Math.min(
          CHINA_PAN_BOUNDS.east,
          Math.max(CHINA_PAN_BOUNDS.west, center.lng),
        );
        const lat = Math.min(
          CHINA_PAN_BOUNDS.north,
          Math.max(CHINA_PAN_BOUNDS.south, center.lat),
        );
        if (Math.abs(lng - center.lng) > 0.02 || Math.abs(lat - center.lat) > 0.02) {
          map.easeTo({ center: [lng, lat], duration: mapDuration(260) });
        }
      };
      const onZoomEnd = (): void => {
        updateLabelVisibility();
        updateClusterBadges();
        loadVisibleCities();
      };
      const onSourceData = (event: MapSourceDataEvent): void => {
        if (event.sourceId === "places" && event.isSourceLoaded) {
          window.setTimeout(updateClusterBadges, 40);
        }
      };
      const onMouseLeave = (): void => {
        popupRef.current?.remove();
        map.getCanvas().style.cursor = "";
        clearHoverState(map, "provinces", hoverProvinceRef.current);
        clearHoverState(map, "cities", hoverCityRef.current);
      };
      const onMouseMove = (event: MapMouseEvent): void => {
        const features = queryFeatures(map, event.point, [
          "places-points",
          "places-clusters",
          "city-fill",
          "province-fill",
        ]);
        if (features.length === 0) {
          map.getCanvas().style.cursor = "grab";
          popupRef.current?.remove();
          clearHoverState(map, "provinces", hoverProvinceRef.current);
          clearHoverState(map, "cities", hoverCityRef.current);
          return;
        }

        map.getCanvas().style.cursor = "pointer";
        const place = features.find((feature) => feature.layer.id === "places-points");
        const cluster = features.find((feature) => feature.layer.id === "places-clusters");
        const city = features.find((feature) => feature.layer.id === "city-fill");
        const province = features.find((feature) => feature.layer.id === "province-fill");

        if (city) {
          const code = normalizeAdcode(city.properties?.adcode as string | number | undefined);
          const id = city.id ?? code;
          clearHoverState(map, "provinces", hoverProvinceRef.current);
          if (id !== undefined) {
            try {
              map.setFeatureState({ source: "cities", id }, { hover: true });
              hoverCityRef.current.add(id);
            } catch {
              // Ignore feature-state failures during a style swap.
            }
          }
        } else {
          clearHoverState(map, "cities", hoverCityRef.current);
        }

        if (province) {
          const code = normalizeAdcode(
            province.properties?.adcode as string | number | undefined,
          );
          const id = province.id ?? code;
          if (id !== undefined) {
            try {
              map.setFeatureState({ source: "provinces", id }, { hover: true });
              hoverProvinceRef.current.add(id);
            } catch {
              // Ignore feature-state failures during a style swap.
            }
          }
        } else if (!city) {
          clearHoverState(map, "provinces", hoverProvinceRef.current);
        }

        const text = place
          ? `${propString(place.properties?.name)}${
              propNumber(place.properties?.entryCount) > 0
                ? ` · ${propNumber(place.properties?.entryCount)} 条简记`
                : ""
            }`
          : cluster
            ? `${propNumber(cluster.properties?.point_count)} 个地点 · 点击放大`
            : city
              ? propString(city.properties?.name)
              : propString(province?.properties?.name);
        if (!text) return;
        let popup = popupRef.current;
        if (!popup) {
          popup = new Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 14,
            className: "map-hover-popup",
          });
          popupRef.current = popup;
        }
        popup.setLngLat(event.lngLat).setText(text).addTo(map);
      };
      const onClick = (event: MapMouseEvent): void => {
        popupRef.current?.remove();
        const features = queryFeatures(map, event.point, [
          "places-points",
          "places-clusters",
          "city-fill",
          "province-fill",
        ]);
        const place = features.find((feature) => feature.layer.id === "places-points");
        if (place) {
          const placeId = propString(place.properties?.placeId);
          if (placeId) handlersRef.current.onSelectPlace(placeId);
          return;
        }
        const cluster = features.find((feature) => feature.layer.id === "places-clusters");
        if (cluster) {
          const clusterId = Number(cluster.properties?.cluster_id);
          const source = map.getSource("places") as GeoJSONSource | undefined;
          if (source && Number.isFinite(clusterId)) {
            source.getClusterExpansionZoom(clusterId).then((zoom) => {
              map.easeTo({
                center: (cluster.geometry as GeoPoint).coordinates as [number, number],
                zoom: Math.min(zoom + 0.1, 15),
                duration: mapDuration(600),
                essential: true,
              });
            });
          }
          return;
        }
        const city = features.find((feature) => feature.layer.id === "city-fill");
        if (city) {
          const center = normalizeCenter(city.properties, city as unknown as AdministrativeFeature);
          if (center) {
            map.flyTo({
              center,
              zoom: Math.max(map.getZoom(), 8.8),
              duration: mapDuration(750),
              essential: true,
            });
          }
          return;
        }
        const province = features.find((feature) => feature.layer.id === "province-fill");
        if (province) {
          const bounds = getGeometryBounds(province.geometry);
          if (bounds) {
            map.fitBounds(
              [
                [bounds[0], bounds[1]],
                [bounds[2], bounds[3]],
              ],
              {
                padding: { top: 70, right: 70, bottom: 70, left: 70 },
                duration: mapDuration(750),
                maxZoom: 6.1,
                essential: true,
              },
            );
            loadVisibleCities();
            return;
          }
        }
        handlersRef.current.onClearSelection();
      };

      map.on("move", onMove);
      map.on("movestart", onMoveStart);
      map.on("moveend", onMoveEnd);
      map.on("zoomend", onZoomEnd);
      map.on("sourcedata", onSourceData);
      map.on("mousemove", onMouseMove);
      map.on("mouseout", onMouseLeave);
      map.on("click", onClick);

      return () => {
        map.off("move", onMove);
        map.off("movestart", onMoveStart);
        map.off("moveend", onMoveEnd);
        map.off("zoomend", onZoomEnd);
        map.off("sourcedata", onSourceData);
        map.off("mousemove", onMouseMove);
        map.off("mouseout", onMouseLeave);
        map.off("click", onClick);
      };
    }, [
      mapReady,
      loadVisibleCities,
      updateClusterBadges,
      updateLabelVisibility,
    ]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      const timer = window.setTimeout(() => {
        loadVisibleCities();
        updateClusterBadges();
        updateLabelVisibility();
      }, 180);
      return () => window.clearTimeout(timer);
    }, [mapReady, provinceData, loadVisibleCities, updateClusterBadges, updateLabelVisibility]);

    useEffect(() => {
      if (!mapReady) return;
      let frame = 0;
      const refit = (): void => {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          const map = mapRef.current;
          if (!map) return;
          if (userMovedRef.current) {
            // Keep the user's current view; the next reset uses fresh padding.
            updateLabelVisibility();
            return;
          }
          fitChina(map, 0);
        });
      };
      window.addEventListener("resize", refit);
      window.addEventListener("orientationchange", refit);
      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("resize", refit);
        window.removeEventListener("orientationchange", refit);
      };
    }, [mapReady, fitChina, updateLabelVisibility]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      for (const { marker } of provinceMarkersRef.current) marker.remove();
      provinceMarkersRef.current = [];
      if (!provinceData) return;
      for (const feature of provinceData.features as AdminFeature[]) {
        const center = normalizeCenter(feature.properties, feature);
        const name = propString(feature.properties?.name);
        if (!center || !name) continue;
        const element = createLabel(name, "map-label--province");
        if (feature.properties?._visited) element.classList.add("map-label--visited");
        if (MUNICIPALITY_CODES.has(normalizeAdcode(feature.properties?.adcode))) {
          element.classList.add("map-label--municipality");
        }
        const marker = new Marker({
          element,
          anchor: "center",
          // Centroid labels sit exactly where a place marker often is; lifting
          // them keeps the dot itself clickable and visible.
          offset: [0, -12],
        })
          .setLngLat(center)
          .addTo(map);
        provinceMarkersRef.current.push({ marker, element });
      }
      updateLabelVisibility();
    }, [mapReady, provinceData, updateLabelVisibility]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      for (const { marker } of cityMarkersRef.current) marker.remove();
      cityMarkersRef.current = [];
      if (!cityData) return;
      for (const feature of cityData.features as AdminFeature[]) {
        const code = normalizeAdcode(feature.properties?.adcode);
        if (MUNICIPALITY_CODES.has(code)) continue;
        const center = normalizeCenter(feature.properties, feature);
        const name = propString(feature.properties?.name);
        if (!center || !name) continue;
        const visited = Boolean(feature.properties?._visited);
        const element = createLabel(name, "map-label--city");
        if (visited) element.classList.add("map-label--visited");
        const marker = new Marker({ element, anchor: "center", offset: [0, -12] })
          .setLngLat(center)
          .addTo(map);
        cityMarkersRef.current.push({ marker, element, center, visited });
      }
      updateLabelVisibility();
    }, [mapReady, cityData, updateLabelVisibility]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      selectedMarkerRef.current?.remove();
      selectedMarkerRef.current = null;
      if (!selectedPlace) return;
      if (!Number.isFinite(selectedPlace.lng) || !Number.isFinite(selectedPlace.lat)) return;
      const element = createPinLabel(selectedPlace.name);
      selectedMarkerRef.current = new Marker({
        element,
        anchor: "bottom",
        offset: [0, -9],
      })
        .setLngLat([selectedPlace.lng, selectedPlace.lat])
        .addTo(map);
    }, [mapReady, selectedPlace]);

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      for (const marker of routeMarkersRef.current) marker.remove();
      routeMarkersRef.current = [];
      if (!activeTrip) return;
      for (let index = 0; index < activeTrip.cityRoute.length; index += 1) {
        const city = activeTrip.cityRoute[index];
        if (!city || !Number.isFinite(city.lng) || !Number.isFinite(city.lat)) continue;
        const element = createRouteStop(index + 1);
        const marker = new Marker({ element, anchor: "center" })
          .setLngLat([city.lng, city.lat])
          .addTo(map);
        routeMarkersRef.current.push(marker);
      }
    }, [mapReady, activeTrip]);

    useEffect(() => {
      if (!selectedPlace) return;
      loadProvince(selectedPlace.provinceCode);
    }, [selectedPlace, loadProvince]);

    useImperativeHandle(
      ref,
      () => ({
        focusPlace(place: Place) {
          const map = mapRef.current;
          if (!map) return;
          loadProvince(place.provinceCode);
          const isMobile = window.matchMedia("(max-width: 759px)").matches;
          map.flyTo({
            center: [place.lng, place.lat],
            zoom: Math.max(map.getZoom(), SELECTED_ZOOM),
            offset: isMobile ? [0, -Math.min(170, window.innerHeight * 0.15)] : [0, 0],
            duration: mapDuration(950),
            curve: 1.5,
            essential: true,
          });
        },
        focusRoute(cities: RouteCity[]) {
          const map = mapRef.current;
          if (!map) return;
          const points = cities.filter(
            (city) => Number.isFinite(city.lng) && Number.isFinite(city.lat),
          );
          if (points.length === 0) return;
          if (points.length === 1) {
            const city = points[0];
            if (!city) return;
            map.flyTo({
              center: [city.lng, city.lat],
              zoom: Math.max(map.getZoom(), 9.2),
              duration: mapDuration(800),
              essential: true,
            });
            return;
          }
          let west = Infinity;
          let south = Infinity;
          let east = -Infinity;
          let north = -Infinity;
          for (const city of points) {
            west = Math.min(west, city.lng);
            east = Math.max(east, city.lng);
            south = Math.min(south, city.lat);
            north = Math.max(north, city.lat);
          }
          map.fitBounds(
            [
              [west, south],
              [east, north],
            ],
            {
              padding: computeFitPadding(
                panelLayoutRef.current,
                detailOpenRef.current,
              ),
              maxZoom: 9.2,
              duration: mapDuration(800),
              essential: true,
            },
          );
        },
        resetView() {
          const map = mapRef.current;
          if (!map) return;
          userMovedRef.current = false;
          fitChina(map, 850);
          loadVisibleCities();
        },
      }),
      [fitChina, loadProvince, loadVisibleCities],
    );

    const retryCities = (): void => {
      failedCityRef.current.clear();
      setCityErrors(0);
      loadVisibleCities();
    };

    const retryBasemap = (): void => {
      setBasemapError(false);
      retryMapConfig();
      setBasemapVersion((value) => value + 1);
    };

    const basemapNotice = basemapError
      ? "底图瓦片加载失败"
      : mapConfigError
        ? "底图配置加载失败"
        : null;

    return (
      <div className="travel-map" ref={containerRef}>
        <div className="map-controls" aria-label="地图控制">
          <button
            aria-label="放大地图"
            className="map-control"
            onClick={() => mapRef.current?.zoomIn({ duration: mapDuration(280) })}
            title="放大"
            type="button"
          >
            +
          </button>
          <button
            aria-label="缩小地图"
            className="map-control"
            onClick={() => mapRef.current?.zoomOut({ duration: mapDuration(280) })}
            title="缩小"
            type="button"
          >
            −
          </button>
          <button
            aria-label="回到全国视图"
            className="map-control map-control--reset"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              userMovedRef.current = false;
              fitChina(map, 850);
              loadVisibleCities();
            }}
            title="全国视图"
            type="button"
          >
            <ResetIcon />
          </button>
        </div>

        {!mapReady || (provinceLoading && !provinces) ? (
          <div className="map-loading">
            <Spinner size={22} label="正在绘制中国地图" />
            <span>正在绘制中国地图</span>
          </div>
        ) : null}

        {provinceError ? (
          <div className="map-data-error">
            <ErrorState
              compact
              message={provinceError}
              onRetry={() => setProvinceVersion((value) => value + 1)}
              title="地图边界未加载"
            />
          </div>
        ) : null}

        {cityErrors > 0 && mapZoom >= CITY_LOAD_ZOOM ? (
          <div className="map-status">
            <span>部分城市边界未能加载</span>
            <button className="text-btn" onClick={retryCities} type="button">
              重试
            </button>
          </div>
        ) : null}

        {basemapNotice ? (
          <div className="map-status map-status--basemap" role="status">
            <span>{basemapNotice}，仍可查看足迹</span>
            <button className="text-btn" onClick={retryBasemap} type="button">
              重试
            </button>
          </div>
        ) : null}

        {cityLoading && mapZoom >= CITY_LOAD_ZOOM ? (
          <div className="map-status map-status--quiet">
            <Spinner size={13} label="正在加载城市边界" />
            <span>正在加载城市边界</span>
          </div>
        ) : null}

        {withBasemap && !basemapError ? null : (
          <div className="map-credit">行政区划 · 本地矢量数据</div>
        )}
      </div>
    );
  },
);
