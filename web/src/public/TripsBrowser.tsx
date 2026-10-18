import { useEffect, useMemo, useState } from "react";
import type { EntrySummary, Place, Trip } from "../types";
import { navigate } from "../lib/router";
import { formatDateRange } from "../lib/date";
import { buildTripSummaries, tripYear } from "../lib/tripSummary";
import { CalendarIcon, MapPinIcon, RouteIcon } from "../icons";
import { EmptyState, ErrorState } from "../components/States";
import { Spinner } from "../components/Spinner";

export function TripsBrowser({
  trips,
  entries,
  placesById,
  loading,
  error,
  onRetry,
}: {
  trips: Trip[];
  entries: EntrySummary[];
  placesById: Map<string, Place>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const summaries = useMemo(
    () => buildTripSummaries(trips, entries, placesById),
    [trips, entries, placesById],
  );
  const years = useMemo(() => {
    const values = new Set<string>();
    for (const summary of summaries) values.add(tripYear(summary));
    return Array.from(values).sort((first, second) => {
      if (first === "暂无简记") return 1;
      if (second === "暂无简记") return -1;
      return second.localeCompare(first);
    });
  }, [summaries]);
  const [year, setYear] = useState("all");

  useEffect(() => {
    if (year !== "all" && !years.includes(year)) setYear("all");
  }, [year, years]);

  const shown = year === "all" ? summaries : summaries.filter((summary) => tripYear(summary) === year);
  const entryCount = entries.filter((entry) => entry.tripId).length;

  return (
    <section aria-label="旅行分组" className="side-panel trips-panel floating-panel">
      <header className="panel-head">
        <div>
          <p className="eyebrow">旅行分组</p>
          <h1>Trips</h1>
          <p className="panel-head__sub">
            {summaries.length > 0
              ? `${summaries.length} 段旅行 · ${entryCount} 条已归档简记`
              : "把简记收进一次旅行"}
          </p>
        </div>
        <span className="panel-head__count">{summaries.length}</span>
      </header>

      {years.length > 1 ? (
        <div aria-label="按年份浏览旅行" className="year-pills" role="group">
          <button
            aria-pressed={year === "all"}
            className={`year-pill${year === "all" ? " year-pill--active" : ""}`}
            onClick={() => setYear("all")}
            type="button"
          >
            全部
          </button>
          {years.map((item) => (
            <button
              aria-pressed={year === item}
              className={`year-pill${year === item ? " year-pill--active" : ""}`}
              key={item}
              onClick={() => setYear(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      <div className="panel-scroll">
        {loading && summaries.length === 0 ? (
          <div className="panel-skeleton" aria-label="正在加载旅行分组">
            {[0, 1, 2].map((item) => (
              <div className="panel-skeleton__row" key={item}>
                <span className="skeleton skeleton--cover" />
                <span className="panel-skeleton__lines">
                  <span className="skeleton skeleton--lg" />
                  <span className="skeleton skeleton--md" />
                  <span className="skeleton skeleton--sm" />
                </span>
              </div>
            ))}
            <p className="panel-skeleton__hint">
              <Spinner size={14} label="正在加载" />
              正在整理旅行
            </p>
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} title="旅行分组加载失败" />
        ) : summaries.length === 0 ? (
          <EmptyState
            description="旅行分组是可选的，用来把同一段行程的简记放在一起。"
            icon={<RouteIcon />}
            title="还没有旅行分组"
            action={
              <button className="btn btn--primary btn--sm" onClick={() => navigate("/admin")} type="button">
                去管理后台创建
              </button>
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            description="换一个年份看看，或者查看全部旅行。"
            icon={<CalendarIcon />}
            title="这一年还没有旅行"
            action={
              <button className="btn btn--soft btn--sm" onClick={() => setYear("all")} type="button">
                查看全部
              </button>
            }
          />
        ) : (
          <div className="trip-list">
            {shown.map((summary) => (
              <button
                aria-label={`打开旅行 ${summary.trip.title}`}
                className="trip-card"
                key={summary.trip.id}
                onClick={() => navigate(`/trips/${encodeURIComponent(summary.trip.id)}`)}
                type="button"
              >
                <span className={`trip-card__cover${summary.cover ? "" : " trip-card__cover--fallback"}`}>
                  <span aria-hidden className="trip-card__fallback">
                    <RouteIcon />
                  </span>
                  {summary.cover ? (
                    <img
                      alt={summary.cover.alt || summary.trip.title}
                      draggable={false}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                      src={summary.cover.thumbnailUrl}
                    />
                  ) : null}
                </span>
                <span className="trip-card__body">
                  <span className="trip-card__title">{summary.trip.title}</span>
                  <span className="trip-card__date">
                    <CalendarIcon />
                    {formatDateRange(summary.startDate, summary.endDate)}
                  </span>
                  <span className="trip-card__meta">
                    <span>
                      <MapPinIcon />
                      {summary.cityCount} 城市 · {summary.placeCount} 地点
                    </span>
                    <span>{summary.entries.length} 简记</span>
                  </span>
                  {summary.trip.description ? (
                    <span className="trip-card__description">{summary.trip.description}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
