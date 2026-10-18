import { useEffect, useMemo, useRef, useState } from "react";
import type { EntrySummary } from "../types";
import { useCatalog } from "../lib/useCatalog";
import { navigate } from "../lib/router";
import { normalizeAdcode, provinceCodeOfPlace } from "../lib/geo";
import { parseDate, pluralPlaces } from "../lib/date";
import { TravelMap, type TravelMapHandle } from "../map/TravelMap";
import { Brand } from "../components/Brand";
import {
  CompassIcon,
  LockIcon,
  MapIcon,
  MapPinIcon,
  ResetIcon,
  RouteIcon,
  StarIcon,
} from "../icons";
import { TimelinePanel } from "./TimelinePanel";
import { EntryDetail } from "./EntryDetail";
import { PlacePanel } from "./PlacePanel";

type MobileView = "map" | "timeline";

export function PublicPage() {
  const { data, loading, error, reload } = useCatalog();
  const mapRef = useRef<TravelMapHandle>(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [tripFilter, setTripFilter] = useState("all");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("map");
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const trips = data?.trips ?? [];
  const places = data?.places ?? [];
  const allEntries = data?.entries ?? [];

  const placesById = useMemo(
    () => new Map(places.map((place) => [place.id, place])),
    [places],
  );
  const tripsById = useMemo(() => new Map(trips.map((trip) => [trip.id, trip])), [trips]);

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
    return Array.from(values).sort((a, b) => b.localeCompare(a));
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
    if (selectedEntryId && !allEntries.some((entry) => entry.id === selectedEntryId)) {
      setSelectedEntryId(null);
    }
    if (selectedPlaceId && !placesById.has(selectedPlaceId)) {
      setSelectedPlaceId(null);
    }
  }, [allEntries, placesById, selectedEntryId, selectedPlaceId]);

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

  const selectedEntry = selectedEntryId
    ? allEntries.find((entry) => entry.id === selectedEntryId)
    : undefined;
  const selectedPlace = selectedPlaceId ? placesById.get(selectedPlaceId) : undefined;

  const mapPlaces = useMemo(() => {
    const filteredPlaceIds = new Set(filteredEntries.map((entry) => entry.placeId));
    return places.filter(
      (place) => filteredPlaceIds.has(place.id) || place.id === selectedPlace?.id,
    );
  }, [filteredEntries, places, selectedPlace?.id]);

  const footprintPlaces = useMemo(() => {
    const ids = new Set(filteredEntries.map((entry) => entry.placeId));
    return places.filter((place) => ids.has(place.id));
  }, [filteredEntries, places]);

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
    if (tripFilter !== "all") return tripsById.get(tripFilter) ?? null;
    if (selectedEntry?.tripId) return tripsById.get(selectedEntry.tripId) ?? null;
    return null;
  }, [selectedEntry?.tripId, tripFilter, tripsById]);

  const placeEntries = useMemo(() => {
    if (!selectedPlaceId) return [];
    return sortedEntries.filter((entry) => entry.placeId === selectedPlaceId);
  }, [selectedPlaceId, sortedEntries]);

  const stats = useMemo(() => {
    const placeIds = new Set(filteredEntries.map((entry) => entry.placeId));
    const tripIds = new Set(
      filteredEntries
        .map((entry) => entry.tripId)
        .filter((tripId): tripId is string => Boolean(tripId)),
    );
    return {
      entries: filteredEntries.length,
      places: placeIds.size,
      trips: tripIds.size,
    };
  }, [filteredEntries]);

  const detailOpen = Boolean(selectedEntry || selectedPlace);

  const clearSelection = (): void => {
    setSelectedEntryId(null);
    setSelectedPlaceId(null);
  };

  const clearFilters = (): void => {
    setYearFilter("all");
    setTripFilter("all");
    clearSelection();
  };

  const changeYearFilter = (year: string): void => {
    setYearFilter(year);
    clearSelection();
  };

  const changeTripFilter = (tripId: string): void => {
    setTripFilter(tripId);
    clearSelection();
  };

  const selectEntry = (entry: EntrySummary): void => {
    setSelectedEntryId(entry.id);
    setSelectedPlaceId(entry.placeId);
    setMobileView("timeline");
    setMobileExpanded(true);
    const place = placesById.get(entry.placeId);
    if (place) mapRef.current?.focusPlace(place);
  };

  const selectPlace = (placeId: string): void => {
    setSelectedPlaceId(placeId);
    setSelectedEntryId(null);
    setMobileView("timeline");
    setMobileExpanded(true);
  };

  const selectTrip = (tripId: string): void => {
    setTripFilter(tripId);
    setSelectedEntryId(null);
    setSelectedPlaceId(null);
    setMobileView("timeline");
    setMobileExpanded(true);
  };

  const resetView = (): void => {
    // On a phone the timeline sheet covers the map, so "全国" first brings the
    // map back and only then frames the country.
    setMobileView("map");
    setMobileExpanded(false);
    mapRef.current?.resetView();
  };

  const toggleMobileTimeline = (): void => {
    if (mobileView === "timeline") {
      setMobileExpanded((value) => !value);
    } else {
      setMobileView("timeline");
      setMobileExpanded(true);
    }
  };

  return (
    <main
      className={`public-page public-page--view-${mobileView}${
        mobileView === "timeline" ? " public-page--sheet-open" : ""
      }`}
    >
      <TravelMap
        activeTrip={activeTrip}
        detailOpen={detailOpen}
        entries={filteredEntries}
        onClearSelection={clearSelection}
        onSelectPlace={selectPlace}
        places={mapPlaces}
        ref={mapRef}
        selectedPlace={selectedPlace ?? null}
        visitedCityCodes={visitedCityCodes}
        visitedProvinceCodes={visitedProvinceCodes}
      />

      <header className="public-topbar">
        <div className="topbar-brand floating-panel">
          <Brand />
        </div>
        <div className="topbar-actions floating-panel">
          <div className="topbar-stats">
            <span>
              <strong>{loading ? "—" : stats.entries}</strong> 条简记
            </span>
            <span>
              <strong>{loading ? "—" : stats.places}</strong> 个地点
            </span>
            <span className="topbar-stats__trips">
              <strong>{loading ? "—" : stats.trips}</strong> 段旅行
            </span>
          </div>
          <button className="nav-action" onClick={resetView} type="button">
            <ResetIcon />
            <span>全国</span>
          </button>
          <a
            className="nav-action nav-action--primary"
            href="/admin"
            onClick={(event) => {
              event.preventDefault();
              navigate("/admin");
            }}
          >
            <LockIcon />
            <span>管理</span>
          </a>
        </div>
      </header>

      <TimelinePanel
        allEntries={allEntries}
        entries={filteredEntries}
        error={error}
        loading={loading}
        mobileExpanded={mobileExpanded}
        onClearFilters={clearFilters}
        onRetry={reload}
        onSelectEntry={selectEntry}
        onToggleExpanded={() => setMobileExpanded((value) => !value)}
        onTripFilter={changeTripFilter}
        onYearFilter={changeYearFilter}
        placesById={placesById}
        selectedEntryId={selectedEntryId}
        tripFilter={tripFilter}
        trips={trips}
        tripsById={tripsById}
        yearFilter={yearFilter}
        years={years}
      />

      {selectedEntry ? (
        <EntryDetail
          entryId={selectedEntry.id}
          key={selectedEntry.id}
          onClose={() => setSelectedEntryId(null)}
          onSelectTrip={selectTrip}
          onShowPlaceEntries={() => setSelectedEntryId(null)}
          place={placesById.get(selectedEntry.placeId)}
          placeEntryCount={placeEntries.length}
          summary={selectedEntry}
          trip={selectedEntry.tripId ? tripsById.get(selectedEntry.tripId) : undefined}
        />
      ) : selectedPlace ? (
        <PlacePanel
          entries={placeEntries}
          onClose={clearSelection}
          onSelectEntry={selectEntry}
          place={selectedPlace}
          selectedEntryId={selectedEntryId}
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
        <span className="map-legend__hint">缩放查看城市边界与地点</span>
      </div>

      {!loading && !error && allEntries.length === 0 ? (
        <div className="map-welcome floating-panel">
          <span className="map-welcome__icon">
            <MapPinIcon />
          </span>
          <div>
            <p className="eyebrow">从第一段旅程开始</p>
            <h2>地图还在等一个故事</h2>
            <p>登录管理后台，添加地点与简记，足迹会自动点亮在这里。</p>
            <div className="map-welcome__actions">
              <a
                className="btn btn--primary btn--sm"
                href="/admin"
                onClick={(event) => {
                  event.preventDefault();
                  navigate("/admin");
                }}
              >
                <LockIcon />
                开始记录
              </a>
              <span className="map-welcome__hint">
                <RouteIcon />
                城市连线可选
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <nav aria-label="移动端视图" className="mobile-switch">
        <button
          aria-pressed={mobileView === "map"}
          className={mobileView === "map" ? "is-active" : ""}
          onClick={() => setMobileView("map")}
          type="button"
        >
          <MapIcon />
          地图
        </button>
        <button
          aria-pressed={mobileView === "timeline"}
          className={mobileView === "timeline" ? "is-active" : ""}
          onClick={toggleMobileTimeline}
          type="button"
        >
          <StarIcon />
          时间线
        </button>
      </nav>

      <footer className="public-footer">
        <span>TravelMemo</span>
        <span>{pluralPlaces(footprintPlaces.length)} 被点亮</span>
      </footer>
    </main>
  );
}
