import { useMemo } from "react";
import type { EntrySummary, Place, Trip } from "../types";
import { formatDateRange, parseDate, pluralPhotos } from "../lib/date";
import {
  CalendarIcon,
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
  onYearFilter: (year: string) => void;
  onTripFilter: (tripId: string) => void;
  onClearFilters: () => void;
  onSelectEntry: (entry: EntrySummary) => void;
  onRetry: () => void;
}

interface TimelineGroup {
  year: string;
  entries: Array<{ entry: EntrySummary; side: "left" | "right" }>;
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
  onYearFilter,
  onTripFilter,
  onClearFilters,
  onSelectEntry,
  onRetry,
}: TimelinePanelProps) {
  const groups = useMemo(() => {
    const byYear = new Map<string, EntrySummary[]>();
    for (const entry of entries) {
      const year = parseDate(entry.date).year || "日期待定";
      const list = byYear.get(year) ?? [];
      list.push(entry);
      byYear.set(year, list);
    }
    let index = 0;
    return Array.from(byYear.entries()).map(([year, yearEntries]): TimelineGroup => ({
      year,
      entries: yearEntries.map((entry) => {
        const item: { entry: EntrySummary; side: "left" | "right" } = {
          entry,
          side: index % 2 === 0 ? "left" : "right",
        };
        index += 1;
        return item;
      }),
    }));
  }, [entries]);

  const hasFilters = yearFilter !== "all" || tripFilter !== "all";
  const hasAnyEntry = allEntries.length > 0;

  return (
    <section aria-label="旅行时间线" className="center-panel timeline-view floating-panel">
      <header className="timeline-view__head">
        <h1>Timeline</h1>
        <p>
          {entries.length > 0
            ? `${entries.length} 条简记 · 按日期倒序`
            : "用日期串起旅途中的片段"}
        </p>
      </header>

      <div className="timeline-view__filters">
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
                {year}
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
          <button className="text-btn timeline-view__clear" onClick={onClearFilters} type="button">
            清除筛选
          </button>
        ) : null}
      </div>

      <div className="timeline-view__scroll">
        {loading && !allEntries.length ? (
          <div className="timeline-skeleton" aria-label="正在加载时间线">
            {[0, 1, 2].map((item) => (
              <div className="timeline-skeleton__card" key={item}>
                <span className="skeleton skeleton--photo" />
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
            icon={<CalendarIcon />}
            title="这个筛选下还没有简记"
            action={
              <button className="btn btn--soft btn--sm" onClick={onClearFilters} type="button">
                清除筛选
              </button>
            }
          />
        ) : (
          <div className="timeline-track">
            <span aria-hidden className="timeline-track__line" />
            {groups.map((group) => (
              <section className="timeline-year" key={group.year}>
                <div className="timeline-year__pill">
                  <span>{group.year}</span>
                  <i>{group.entries.length}</i>
                </div>
                <div className="timeline-year__items">
                  {group.entries.map(({ entry, side }) => {
                    const place = placesById.get(entry.placeId);
                    const trip = entry.tripId ? tripsById.get(entry.tripId) : undefined;
                    const date = parseDate(entry.date);
                    const cover = entry.photos[0];
                    return (
                      <div
                        className={`timeline-item timeline-item--${side}`}
                        key={entry.id}
                      >
                        <button
                          aria-label={`查看简记 ${entry.title}`}
                          className={`timeline-card${entry.id === selectedEntryId ? " timeline-card--active" : ""}`}
                          onClick={() => onSelectEntry(entry)}
                          type="button"
                        >
                          {cover ? (
                            <span className="timeline-card__media">
                              <img
                                alt={cover.alt || `${entry.title} 的照片`}
                                draggable={false}
                                loading="lazy"
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                                src={cover.thumbnailUrl}
                              />
                              {entry.photos.length > 1 ? (
                                <span className="timeline-card__photo-count">
                                  <ImageIcon />
                                  {entry.photos.length}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                          <span className="timeline-card__body">
                            <span className="timeline-card__date">
                              <CalendarIcon />
                              {formatDateRange(entry.date, entry.endDate ?? entry.date)}
                              {date.weekday && (!entry.endDate || entry.endDate === entry.date) ? ` · ${date.weekday}` : ""}
                            </span>
                            <span className="timeline-card__place">
                              <MapPinIcon />
                              {place?.name ?? "地点已移除"}
                            </span>
                            <span className="timeline-card__title">{entry.title}</span>
                            <span className="timeline-card__meta">
                              {trip ? (
                                <span className="timeline-card__trip">
                                  <RouteIcon />
                                  {trip.title}
                                </span>
                              ) : (
                                <span className="timeline-card__trip timeline-card__trip--muted">
                                  <RouteIcon />
                                  未归入旅行
                                </span>
                              )}
                              {entry.photos.length > 0 ? (
                                <span>{pluralPhotos(entry.photos.length)}</span>
                              ) : null}
                            </span>
                          </span>
                        </button>
                        <span aria-hidden className="timeline-item__dot" />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
