import type { EntrySummary, Place } from "../types";
import type { TripSummary } from "../lib/tripSummary";
import { formatDateRange, parseDate, pluralPhotos } from "../lib/date";
import {
  ArrowLeftIcon,
  CalendarIcon,
  ImageIcon,
  MapPinIcon,
  RouteIcon,
} from "../icons";
import { EmptyState } from "../components/States";

export function TripDetail({
  summary,
  placesById,
  onBack,
  onSelectEntry,
}: {
  summary: TripSummary;
  placesById: Map<string, Place>;
  onBack: () => void;
  onSelectEntry: (entry: EntrySummary) => void;
}) {
  const { trip, entries } = summary;
  const route = trip.cityRoute;

  return (
    <section aria-label="旅行详情" className="side-panel trip-detail floating-panel">
      <header className="panel-head panel-head--detail">
        <button aria-label="返回旅行分组" className="icon-btn" onClick={onBack} type="button">
          <ArrowLeftIcon />
        </button>
        <div className="panel-head__grow">
          <p className="eyebrow">旅行</p>
          <h1>{trip.title}</h1>
          <p className="panel-head__sub">
            <CalendarIcon />
            {formatDateRange(summary.startDate, summary.endDate)}
          </p>
        </div>
        <span className="panel-head__count">{entries.length}</span>
      </header>

      <div className="panel-scroll trip-detail__scroll">
        <div className={`trip-hero${summary.cover ? "" : " trip-hero--fallback"}`}>
          <span aria-hidden className="trip-hero__fallback">
            <RouteIcon />
          </span>
          {summary.cover ? (
            <img
              alt={summary.cover.alt || trip.title}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              src={summary.cover.thumbnailUrl}
            />
          ) : null}
          <span className="trip-hero__shade" />
          <span className="trip-hero__caption">
            <strong>{trip.title}</strong>
            <span>{formatDateRange(summary.startDate, summary.endDate)}</span>
          </span>
        </div>

        {trip.description ? <p className="trip-detail__description">{trip.description}</p> : null}

        <div className="trip-facts">
          <span>
            <MapPinIcon />
            {summary.cityCount} 城市 · {summary.placeCount} 地点
          </span>
          <span>{entries.length} 简记</span>
          <span>{summary.entries.reduce((total, entry) => total + entry.photos.length, 0)} 张照片</span>
        </div>

        {route.length > 0 ? (
          <section aria-label="城市连线" className="trip-route">
            <div className="section-label">
              <RouteIcon />
              城市连线
            </div>
            <ol className="trip-route__stops">
              {route.map((city, index) => (
                <li key={`${city.name}-${index}`}>
                  <span className="trip-route__order">{index + 1}</span>
                  <span>{city.name}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section aria-label="旅行中的简记" className="trip-entries">
          <div className="section-label">
            <CalendarIcon />
            简记
            <span className="section-label__count">{entries.length}</span>
          </div>
          {entries.length === 0 ? (
            <EmptyState
              compact
              description="创建简记时选择这段旅行，内容会出现在这里。"
              icon={<RouteIcon />}
              title="这段旅行还没有简记"
            />
          ) : (
            <div className="trip-entry-list">
              {entries.map((entry) => {
                const place = placesById.get(entry.placeId);
                const date = parseDate(entry.date);
                return (
                  <button
                    aria-label={`查看简记 ${entry.title}`}
                    className="trip-entry"
                    key={entry.id}
                    onClick={() => onSelectEntry(entry)}
                    type="button"
                  >
                    <span className="trip-entry__date">
                      <span>{date.year}</span>
                      <strong>{date.monthDay}</strong>
                    </span>
                    <span className="trip-entry__body">
                      <span className="trip-entry__place">
                        <MapPinIcon />
                        {place?.name ?? "地点已移除"}
                      </span>
                      <span className="trip-entry__title">{entry.title}</span>
                      {entry.photos.length > 0 ? (
                        <span className="trip-entry__meta">
                          <ImageIcon />
                          {pluralPhotos(entry.photos.length)}
                        </span>
                      ) : null}
                    </span>
                    {entry.photos[0] ? (
                      <img
                        alt=""
                        className="trip-entry__cover"
                        loading="lazy"
                        src={entry.photos[0].thumbnailUrl}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
