import { useMemo } from "react";
import type { EntrySummary, Place, Trip } from "../types";
import { formatRelativeYear, parseDate, pluralPhotos } from "../lib/date";
import {
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  CompassIcon,
  ImageIcon,
  MapPinIcon,
  RouteIcon,
} from "../icons";
import { EmptyState, ErrorState } from "../components/States";
import { Spinner } from "../components/Spinner";

interface TimelinePanelProps {
  entries: EntrySummary[];
  allEntries: EntrySummary[];
  years: string[];
  trips: Trip[];
  placesById: Map<string, Place>;
  tripsById: Map<string, Trip>;
  yearFilter: string;
  tripFilter: string;
  selectedEntryId: string | null;
  loading: boolean;
  error: string | null;
  mobileExpanded: boolean;
  onYearFilter: (year: string) => void;
  onTripFilter: (tripId: string) => void;
  onClearFilters: () => void;
  onSelectEntry: (entry: EntrySummary) => void;
  onRetry: () => void;
  onToggleExpanded: () => void;
}

interface EntryCardProps {
  entry: EntrySummary;
  place?: Place;
  trip?: Trip;
  active: boolean;
  onSelect: (entry: EntrySummary) => void;
}

function EntryCard({ entry, place, trip, active, onSelect }: EntryCardProps) {
  const date = parseDate(entry.date);
  const cover = entry.photos[0];

  return (
    <button
      aria-current={active ? "true" : undefined}
      className={`timeline-card${active ? " timeline-card--active" : ""}`}
      onClick={() => onSelect(entry)}
      type="button"
    >
      <span className="timeline-card__date-col">
        <span className="timeline-card__day">{date.day || "·"}</span>
        <span className="timeline-card__month">{date.month ? `${Number(date.month)}月` : ""}</span>
        <span className="timeline-card__dot" aria-hidden />
      </span>
      <span className="timeline-card__content">
        <span className="timeline-card__topline">
          <span className="timeline-card__place">
            <MapPinIcon />
            {place?.name ?? "地点已移除"}
          </span>
          {trip ? (
            <span className="timeline-card__trip">
              <RouteIcon />
              {trip.title}
            </span>
          ) : null}
        </span>
        <span className="timeline-card__title">{entry.title}</span>
        <span className="timeline-card__meta">
          <span>
            <CalendarIcon />
            {date.monthDay}
            {date.weekday ? ` · ${date.weekday}` : ""}
          </span>
          {entry.photos.length > 0 ? (
            <span>
              <ImageIcon />
              {pluralPhotos(entry.photos.length)}
            </span>
          ) : (
            <span>
              <ClockIcon />
              简记
            </span>
          )}
        </span>
      </span>
      {cover ? (
        <span className="timeline-card__media">
          <img
            alt={cover.alt || `${entry.title} 的照片`}
            draggable={false}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
            src={cover.thumbnailUrl}
          />
        </span>
      ) : null}
    </button>
  );
}

export function TimelinePanel({
  entries,
  allEntries,
  years,
  trips,
  placesById,
  tripsById,
  yearFilter,
  tripFilter,
  selectedEntryId,
  loading,
  error,
  mobileExpanded,
  onYearFilter,
  onTripFilter,
  onClearFilters,
  onSelectEntry,
  onRetry,
  onToggleExpanded,
}: TimelinePanelProps) {
  const groups = useMemo(() => {
    const map = new Map<string, EntrySummary[]>();
    for (const entry of entries) {
      const year = parseDate(entry.date).year || "日期待定";
      const list = map.get(year) ?? [];
      list.push(entry);
      map.set(year, list);
    }
    return Array.from(map.entries());
  }, [entries]);

  const hasFilters = yearFilter !== "all" || tripFilter !== "all";
  const hasAnyEntry = allEntries.length > 0;

  return (
    <section
      aria-label="旅行时间线"
      className={`timeline-panel floating-panel timeline-panel--${mobileExpanded ? "expanded" : "peek"}`}
    >
      <div className="timeline-panel__head">
        <div>
          <p className="eyebrow">旅行时间线</p>
          <h1>一路走来的简记</h1>
        </div>
        <button
          aria-expanded={mobileExpanded}
          aria-label={mobileExpanded ? "收起时间线" : "展开时间线"}
          className="icon-btn timeline-panel__toggle"
          onClick={onToggleExpanded}
          type="button"
        >
          <ChevronDownIcon />
        </button>
      </div>

      <div className="timeline-panel__filters">
        <label className="mini-field">
          <span>年份</span>
          <select
            aria-label="按年份筛选"
            onChange={(event) => onYearFilter(event.target.value)}
            value={yearFilter}
          >
            <option value="all">全部年份</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {formatRelativeYear(year)}
              </option>
            ))}
          </select>
        </label>
        <label className="mini-field">
          <span>旅行</span>
          <select
            aria-label="按旅行筛选"
            onChange={(event) => onTripFilter(event.target.value)}
            value={tripFilter}
          >
            <option value="all">全部旅行</option>
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title}
              </option>
            ))}
          </select>
        </label>
        {hasFilters ? (
          <button className="text-btn timeline-panel__clear" onClick={onClearFilters} type="button">
            清除筛选
          </button>
        ) : null}
      </div>

      <div className="timeline-panel__scroll">
        {loading && !allEntries.length ? (
          <div className="timeline-skeleton" aria-label="正在加载时间线">
            {[0, 1, 2].map((item) => (
              <div className="timeline-skeleton__card" key={item}>
                <span className="skeleton skeleton--dot" />
                <span className="timeline-skeleton__lines">
                  <span className="skeleton skeleton--sm" />
                  <span className="skeleton skeleton--lg" />
                  <span className="skeleton skeleton--md" />
                </span>
              </div>
            ))}
            <p className="timeline-skeleton__hint">
              <Spinner size={14} label="正在加载" />
              正在整理旅途
            </p>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} title="时间线加载失败" />
        ) : !hasAnyEntry ? (
          <EmptyState
            description="写下第一段旅程后，它会安静地出现在这里。"
            icon={<CompassIcon />}
            title="还没有旅行简记"
          />
        ) : entries.length === 0 ? (
          <EmptyState
            description="换一个年份或旅行看看，或者清除当前筛选。"
            icon={<ClockIcon />}
            title="这个筛选下还没有简记"
            action={
              <button className="btn btn--soft btn--sm" onClick={onClearFilters} type="button">
                清除筛选
              </button>
            }
          />
        ) : (
          <div className="timeline-groups">
            {groups.map(([year, yearEntries]) => (
              <section className="timeline-group" key={year}>
                <header className="timeline-group__head">
                  <span>{year === "日期待定" ? year : formatRelativeYear(year)}</span>
                  <span className="timeline-group__count">{yearEntries.length} 条</span>
                </header>
                <div className="timeline-group__list">
                  {yearEntries.map((entry) => (
                    <EntryCard
                      active={entry.id === selectedEntryId}
                      entry={entry}
                      key={entry.id}
                      onSelect={onSelectEntry}
                      place={placesById.get(entry.placeId)}
                      trip={entry.tripId ? tripsById.get(entry.tripId) : undefined}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
