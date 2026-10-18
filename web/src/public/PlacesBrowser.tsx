import { useMemo, useState } from "react";
import type { EntrySummary, Place } from "../types";
import { navigate } from "../lib/router";
import { parseDate } from "../lib/date";
import { normalizeAdcode } from "../lib/geo";
import { ChevronDownIcon, MapPinIcon } from "../icons";
import { EmptyState, ErrorState } from "../components/States";

interface PlaceSummary {
  place: Place;
  entries: EntrySummary[];
  years: string[];
  latestDate: string;
  cover: EntrySummary["photos"][number] | null;
}

interface CityGroup {
  key: string;
  name: string;
  latestDate: string;
  places: PlaceSummary[];
}

interface ProvinceGroup {
  key: string;
  name: string;
  latestDate: string;
  cities: CityGroup[];
}

function buildGroups(places: Place[], entries: EntrySummary[]): ProvinceGroup[] {
  const plansById = new Map<string, EntrySummary[]>();
  for (const entry of entries) {
    const list = plansById.get(entry.placeId) ?? [];
    list.push(entry);
    plansById.set(entry.placeId, list);
  }

  const provinces = new Map<string, ProvinceGroup>();
  for (const place of places) {
    const placeEntries = plansById.get(place.id);
    if (!placeEntries || placeEntries.length === 0) continue;
    const sorted = [...placeEntries].sort(
      (first, second) =>
        second.date.localeCompare(first.date) || second.id.localeCompare(first.id),
    );
    const years = Array.from(
      new Set(sorted.map((entry) => parseDate(entry.date).year).filter(Boolean)),
    ).sort((first, second) => second.localeCompare(first));
    const latestDate = sorted[0]?.date ?? "";
    const summary: PlaceSummary = {
      place,
      entries: sorted,
      years,
      latestDate,
      cover: sorted.find((entry) => entry.photos.length > 0)?.photos[0] ?? null,
    };

    const provinceKey = normalizeAdcode(place.provinceCode) || place.province || "未知省份";
    const provinceName = place.province || "未标注省份";
    const cityName = place.city && place.city !== place.province ? place.city : "其他地点";
    const cityKey = normalizeAdcode(place.cityCode) || cityName;

    let province = provinces.get(provinceKey);
    if (!province) {
      province = { key: provinceKey, name: provinceName, latestDate, cities: [] };
      provinces.set(provinceKey, province);
    }
    province.latestDate = [province.latestDate, latestDate].sort().at(-1) ?? latestDate;
    let city = province.cities.find((item) => item.key === cityKey);
    if (!city) {
      city = { key: cityKey, name: cityName, latestDate, places: [] };
      province.cities.push(city);
    }
    city.latestDate = [city.latestDate, latestDate].sort().at(-1) ?? latestDate;
    city.places.push(summary);
  }

  const result = Array.from(provinces.values());
  for (const province of result) {
    province.cities.sort(
      (first, second) =>
        second.latestDate.localeCompare(first.latestDate) ||
        first.name.localeCompare(second.name, "zh-CN"),
    );
    for (const city of province.cities) {
      city.places.sort(
        (first, second) =>
          second.latestDate.localeCompare(first.latestDate) ||
          first.place.name.localeCompare(second.place.name, "zh-CN"),
      );
    }
  }
  result.sort(
    (first, second) =>
      second.latestDate.localeCompare(first.latestDate) ||
      first.name.localeCompare(second.name, "zh-CN"),
  );
  return result;
}

export function PlacesBrowser({
  places,
  entries,
  loading,
  error,
  onRetry,
}: {
  places: Place[];
  entries: EntrySummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const groups = useMemo(() => buildGroups(places, entries), [places, entries]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const placeCount = groups.reduce(
    (total, province) =>
      total +
      province.cities.reduce((cityTotal, city) => cityTotal + city.places.length, 0),
    0,
  );

  const toggleProvince = (key: string): void => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <section aria-label="地点" className="side-panel places-panel floating-panel">
      <header className="panel-head">
        <div>
          <p className="eyebrow">按省市浏览</p>
          <h1>Places</h1>
          <p className="panel-head__sub">
            {placeCount > 0
              ? `${placeCount} 个有记录的地点 · ${groups.length} 个省份`
              : "同一个地点，保留每一次到访"}
          </p>
        </div>
        <span className="panel-head__count">{placeCount}</span>
      </header>

      <div className="panel-scroll">
        {loading && groups.length === 0 ? (
          <div className="panel-skeleton" aria-label="正在加载地点">
            {[0, 1, 2, 3].map((item) => (
              <div className="panel-skeleton__row" key={item}>
                <span className="skeleton skeleton--cover" />
                <span className="panel-skeleton__lines">
                  <span className="skeleton skeleton--lg" />
                  <span className="skeleton skeleton--md" />
                </span>
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} title="地点加载失败" />
        ) : placeCount === 0 ? (
          <EmptyState
            description="写入第一条简记后，地点会按省份和城市自动归到这里。"
            icon={<MapPinIcon />}
            title="还没有地点记录"
            action={
              <button className="btn btn--primary btn--sm" onClick={() => navigate("/admin")} type="button">
                去管理后台添加
              </button>
            }
          />
        ) : (
          <div className="place-groups">
            {groups.map((province) => {
              const isCollapsed = collapsed.has(province.key);
              return (
                <section className="place-group" key={province.key}>
                  <button
                    aria-expanded={!isCollapsed}
                    className="place-group__head"
                    onClick={() => toggleProvince(province.key)}
                    type="button"
                  >
                    <span className="place-group__name">{province.name}</span>
                    <span className="place-group__count">
                      {province.cities.reduce((total, city) => total + city.places.length, 0)} 地点
                    </span>
                    <ChevronDownIcon
                      className={`place-group__chevron${isCollapsed ? " is-collapsed" : ""}`}
                    />
                  </button>
                  {isCollapsed ? null : (
                    <div className="place-group__body">
                      {province.cities.map((city) => (
                        <div className="place-city" key={city.key}>
                          <div className="place-city__label">{city.name}</div>
                          <div className="place-city__list">
                            {city.places.map((summary) => (
                              <button
                                aria-label={`查看地点 ${summary.place.name}`}
                                className="place-row"
                                key={summary.place.id}
                                onClick={() =>
                                  navigate(`/places/${encodeURIComponent(summary.place.id)}`)
                                }
                                type="button"
                              >
                                <span
                                  className={`place-row__cover${summary.cover ? "" : " place-row__cover--fallback"}`}
                                >
                                  <MapPinIcon />
                                  {summary.cover ? (
                                    <img
                                      alt=""
                                      loading="lazy"
                                      onError={(event) => {
                                        event.currentTarget.style.display = "none";
                                      }}
                                      src={summary.cover.thumbnailUrl}
                                    />
                                  ) : null}
                                </span>
                                <span className="place-row__body">
                                  <span className="place-row__title">{summary.place.name}</span>
                                  <span className="place-row__meta">
                                    {summary.entries.length} 次记录
                                    {summary.years.length > 0
                                      ? ` · ${summary.years.join(" / ")}`
                                      : ""}
                                  </span>
                                </span>
                                <span className="place-row__latest">
                                  {parseDate(summary.latestDate).monthDay}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
