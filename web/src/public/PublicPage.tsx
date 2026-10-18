import { useEffect, useMemo, useRef, useState } from "react";
import type { EntrySummary } from "../types";
import { useCatalog } from "../lib/useCatalog";
import { navigate, type PublicRoute } from "../lib/router";
import { normalizeAdcode, provinceCodeOfPlace } from "../lib/geo";
import { parseDate } from "../lib/date";
import { buildTripSummaries } from "../lib/tripSummary";
import { useTheme } from "../lib/theme";
import {
  TravelMap,
  type MapPanelLayout,
  type TravelMapHandle,
} from "../map/TravelMap";
import { PublicNav } from "../components/PublicNav";
import {
  CompassIcon,
  LockIcon,
  MapPinIcon,
  RouteIcon,
} from "../icons";
import { TripsBrowser } from "./TripsBrowser";
import { TripDetail } from "./TripDetail";
import { PlacesBrowser } from "./PlacesBrowser";
import { TimelinePanel } from "./TimelinePanel";
import { StatsPanel } from "./StatsPanel";
import { EntryDetail } from "./EntryDetail";
import { PlacePanel } from "./PlacePanel";

export function PublicPage({ route }: { route: PublicRoute }) {
  const { data, loading, error, reload } = useCatalog();
  const { theme } = useTheme();
  const mapRef = useRef<TravelMapHandle>(null);
  const focusedRef = useRef("");
  const [yearFilter, setYearFilter] = useState("all");
  const [tripFilter, setTripFilter] = useState("all");

  const trips = data?.trips ?? [];
  const places = data?.places ?? [];
  const allEntries = data?.entries ?? [];

  const placesById = useMemo(
    () => new Map(places.map((place) => [place.id, place])),
    [places],
  );
  const tripsById = useMemo(
    () => new Map(trips.map((trip) => [trip.id, trip])),
    [trips],
  );

  const sortedEntries = useMemo(
    () =>
      [...allEntries].sort(
        (first, second) =>
          second.date.localeCompare(first.date) || second.id.localeCompare(first.id),
      ),
    [allEntries],
  );

  const years = useMemo(() => {
    const values = new Set<string>();
    for (const entry of allEntries) {
      const year = parseDate(entry.date).year;
      if (year) values.add(year);
    }
    return Array.from(values).sort((first, second) => second.localeCompare(first));
  }, [allEntries]);

  useEffect(() => {
    if (yearFilter !== "all" && !years.includes(yearFilter)) setYearFilter("all");
  }, [yearFilter, years]);

  useEffect(() => {
    if (tripFilter !== "all" && !trips.some((trip) => trip.id === tripFilter)) {
      setTripFilter("all");
    }
  }, [tripFilter, trips]);

  useEffect(() => {
    if (
      route.entryId &&
      data &&
      !allEntries.some((entry) => entry.id === route.entryId)
    ) {
      navigate("/timeline", { replace: true });
    }
  }, [route.entryId, data, allEntries]);

  const filteredEntries = useMemo(
    () =>
      sortedEntries.filter((entry) => {
        const yearMatch =
          yearFilter === "all" || parseDate(entry.date).year === yearFilter;
        const tripMatch = tripFilter === "all" || entry.tripId === tripFilter;
        return yearMatch && tripMatch;
      }),
    [sortedEntries, yearFilter, tripFilter],
  );

  const mapEntries = route.view === "timeline" ? filteredEntries : sortedEntries;

  const selectedEntry = route.entryId
    ? allEntries.find((entry) => entry.id === route.entryId)
    : undefined;
  const routePlace = route.placeId ? placesById.get(route.placeId) : undefined;
  const tripSummaries = useMemo(
    () => buildTripSummaries(trips, allEntries, placesById),
    [trips, allEntries, placesById],
  );
  const selectedTrip = route.tripId
    ? tripSummaries.find((summary) => summary.trip.id === route.tripId)
    : undefined;

  const selectedPlace =
    routePlace ??
    (selectedEntry ? placesById.get(selectedEntry.placeId) : undefined);
  const placeEntries = useMemo(() => {
    if (!selectedPlace) return [];
    return sortedEntries.filter((entry) => entry.placeId === selectedPlace.id);
  }, [selectedPlace, sortedEntries]);

  const mapPlaces = useMemo(() => {
    const filteredIds = new Set(mapEntries.map((entry) => entry.placeId));
    return places.filter(
      (place) => filteredIds.has(place.id) || place.id === selectedPlace?.id,
    );
  }, [mapEntries, places, selectedPlace?.id]);

  const footprintPlaces = useMemo(() => {
    const ids = new Set(mapEntries.map((entry) => entry.placeId));
    return places.filter((place) => ids.has(place.id));
  }, [mapEntries, places]);

  const visitedProvinceCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const place of footprintPlaces) {
      const code = provinceCodeOfPlace(place);
      if (code) codes.add(code);
    }
    return codes;
  }, [footprintPlaces]);

  const visitedCityCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const place of footprintPlaces) {
      const city = normalizeAdcode(place.cityCode);
      if (city) codes.add(city);
      else {
        const province = provinceCodeOfPlace(place);
        if (province) codes.add(province);
      }
    }
    return codes;
  }, [footprintPlaces]);

  const activeTrip = useMemo(() => {
    if (selectedTrip) return selectedTrip.trip;
    if (route.view === "timeline" && tripFilter !== "all") {
      return tripsById.get(tripFilter) ?? null;
    }
    return null;
  }, [selectedTrip, route.view, tripFilter, tripsById]);

  const detailOpen = Boolean(
    selectedEntry || (routePlace && route.view === "places"),
  );
  const panelLayout: MapPanelLayout =
    route.view === "timeline" || route.view === "stats"
      ? "center"
      : route.view === "trips" || route.view === "places"
        ? "left"
        : "none";
  const detailId =
    selectedTrip?.trip.id ?? selectedEntry?.id ?? routePlace?.id ?? null;

  useEffect(() => {
    const key = selectedEntry
      ? `entry:${selectedEntry.id}`
      : routePlace
        ? `place:${routePlace.id}`
        : selectedTrip
          ? `trip:${selectedTrip.trip.id}`
          : "";
    if (!key) {
      focusedRef.current = "";
      return;
    }
    if (focusedRef.current === key) return;
    focusedRef.current = key;
    if (selectedEntry) {
      const place = placesById.get(selectedEntry.placeId);
      if (place) mapRef.current?.focusPlace(place);
      return;
    }
    if (routePlace) {
      mapRef.current?.focusPlace(routePlace);
      return;
    }
    if (selectedTrip && selectedTrip.trip.cityRoute.length > 0) {
      mapRef.current?.focusRoute(selectedTrip.trip.cityRoute);
    }
  }, [selectedEntry, routePlace, selectedTrip, placesById]);

  const selectEntry = (entry: EntrySummary): void => {
    navigate(`/timeline/${encodeURIComponent(entry.id)}`);
  };

  const selectPlace = (placeId: string): void => {
    navigate(`/places/${encodeURIComponent(placeId)}`);
  };

  const selectTrip = (tripId: string): void => {
    navigate(`/trips/${encodeURIComponent(tripId)}`);
  };

  const clearFilters = (): void => {
    setYearFilter("all");
    setTripFilter("all");
  };

  const changeYearFilter = (year: string): void => {
    setYearFilter(year);
  };

  const changeTripFilter = (tripId: string): void => {
    setTripFilter(tripId);
  };

  const clearSelection = (): void => {
    if (selectedEntry) {
      navigate("/timeline");
      return;
    }
    if (routePlace) navigate("/places");
  };

  return (
    <main
      className={`public-page public-page--view-${route.view}${
        route.view === "map" ? "" : " public-page--panel"
      }${detailOpen ? " public-page--detail" : ""}`}
    >
      <TravelMap
        activeTrip={activeTrip}
        detailOpen={detailOpen}
        entries={mapEntries}
        onClearSelection={clearSelection}
        onSelectPlace={selectPlace}
        places={mapPlaces}
        ref={mapRef}
        selectedPlace={selectedPlace ?? null}
        theme={theme}
        visitedCityCodes={visitedCityCodes}
        visitedProvinceCodes={visitedProvinceCodes}
        panelLayout={panelLayout}
      />

      <PublicNav
        activeView={route.view}
        detailId={detailId}
        onReturnMap={() => {
          navigate("/");
          window.requestAnimationFrame(() => mapRef.current?.resetView());
        }}
      />

      {route.view === "trips" ? (
        selectedTrip ? (
          <TripDetail
            onBack={() => navigate("/trips")}
            onSelectEntry={selectEntry}
            placesById={placesById}
            summary={selectedTrip}
          />
        ) : (
          <TripsBrowser
            entries={allEntries}
            error={error}
            loading={loading}
            onRetry={reload}
            placesById={placesById}
            trips={trips}
          />
        )
      ) : null}

      {route.view === "places" ? (
        <PlacesBrowser
          entries={allEntries}
          error={error}
          loading={loading}
          onRetry={reload}
          places={places}
        />
      ) : null}

      {route.view === "timeline" ? (
        <TimelinePanel
          allEntries={allEntries}
          entries={filteredEntries}
          error={error}
          loading={loading}
          onClearFilters={clearFilters}
          onRetry={reload}
          onSelectEntry={selectEntry}
          onTripFilter={changeTripFilter}
          onYearFilter={changeYearFilter}
          placesById={placesById}
          selectedEntryId={selectedEntry?.id ?? null}
          tripFilter={tripFilter}
          trips={trips}
          tripsById={tripsById}
          yearFilter={yearFilter}
          years={years}
        />
      ) : null}

      {route.view === "stats" ? (
        <StatsPanel
          entries={allEntries}
          error={error}
          loading={loading}
          onRetry={reload}
          places={places}
          trips={trips}
        />
      ) : null}

      {selectedEntry ? (
        <EntryDetail
          entryId={selectedEntry.id}
          key={selectedEntry.id}
          onClose={() => navigate("/timeline")}
          onSelectTrip={selectTrip}
          onShowPlaceEntries={() => {
            if (selectedEntry.placeId) selectPlace(selectedEntry.placeId);
          }}
          place={placesById.get(selectedEntry.placeId)}
          placeEntryCount={placeEntries.length}
          summary={selectedEntry}
          trip={
            selectedEntry.tripId ? tripsById.get(selectedEntry.tripId) : undefined
          }
        />
      ) : route.view === "places" && routePlace ? (
        <PlacePanel
          entries={placeEntries}
          onClose={() => navigate("/places")}
          onSelectEntry={selectEntry}
          place={routePlace}
          selectedEntryId={null}
          tripsById={tripsById}
        />
      ) : null}

      <div className="map-legend floating-panel" aria-label="地图图例">
        <span className="map-legend__title">
          <CompassIcon />
          地图图例
        </span>
        <span className="map-legend__item">
          <i className="legend-swatch legend-swatch--province" />
          到访省份
        </span>
        <span className="map-legend__item">
          <i className="legend-swatch legend-swatch--city" />
          到访城市
        </span>
        <span className="map-legend__item">
          <i className="legend-swatch legend-swatch--place" />
          简记地点
        </span>
        {activeTrip && activeTrip.cityRoute.length > 1 ? (
          <span className="map-legend__item map-legend__item--route">
            <i className="legend-swatch legend-swatch--route" />
            {activeTrip.title} · {activeTrip.cityRoute.length} 城连线
          </span>
        ) : null}
      </div>

      {!loading && !error && allEntries.length === 0 && route.view === "map" ? (
        <div className="map-welcome floating-panel">
          <span className="map-welcome__icon">
            <MapPinIcon />
          </span>
          <div>
            <p className="eyebrow">从第一段旅程开始</p>
            <h2>地图还在等一个故事</h2>
            <p>登录管理后台，添加地点与简记，足迹会自动点亮在这里。</p>
            <div className="map-welcome__actions">
              <button
                className="btn btn--primary btn--sm"
                onClick={() => navigate("/admin")}
                type="button"
              >
                <LockIcon />
                开始记录
              </button>
              <span className="map-welcome__hint">
                <RouteIcon />
                城市连线可选
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
