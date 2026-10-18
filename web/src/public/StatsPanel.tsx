import { useMemo } from "react";
import type { EntrySummary, Place, Trip } from "../types";
import { parseDate } from "../lib/date";
import { normalizeAdcode, provinceCodeOfPlace } from "../lib/geo";
import {
  CalendarIcon,
  CompassIcon,
  ImageIcon,
  MapIcon,
  MapPinIcon,
  RouteIcon,
} from "../icons";
import { EmptyState, ErrorState } from "../components/States";

interface ProvinceStat {
  key: string;
  name: string;
  places: number;
  entries: number;
}

interface YearStat {
  year: string;
  count: number;
}

function buildStats(places: Place[], entries: EntrySummary[], trips: Trip[]) {
  const placeById = new Map(places.map((place) => [place.id, place]));
  const placeIds = new Set<string>();
  const cityKeys = new Set<string>();
  const provinceMap = new Map<string, { name: string; placeIds: Set<string>; entries: number }>();
  const yearCounts = new Map<string, number>();
  const tripIds = new Set<string>();
  let photos = 0;

  for (const entry of entries) {
    const place = placeById.get(entry.placeId);
    if (!place) continue;
    placeIds.add(place.id);
    const provinceKey = provinceCodeOfPlace(place) || place.province || "未知省份";
    const provinceName = place.province || "未标注省份";
    let province = provinceMap.get(provinceKey);
    if (!province) {
      province = { name: provinceName, placeIds: new Set(), entries: 0 };
      provinceMap.set(provinceKey, province);
    }
    province.placeIds.add(place.id);
    province.entries += 1;

    const cityKey =
      normalizeAdcode(place.cityCode) ||
      [place.province, place.city, place.name].filter(Boolean).join("|");
    if (cityKey) cityKeys.add(cityKey);

    if (entry.tripId) tripIds.add(entry.tripId);
    photos += entry.photos.length;

    const year = parseDate(entry.date).year;
    if (year) yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
  }

  const provinces: ProvinceStat[] = Array.from(provinceMap.entries())
    .map(([key, value]) => ({
      key,
      name: value.name,
      places: value.placeIds.size,
      entries: value.entries,
    }))
    .sort(
      (first, second) =>
        second.entries - first.entries ||
        second.places - first.places ||
        first.name.localeCompare(second.name, "zh-CN"),
    );

  const years: YearStat[] = Array.from(yearCounts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((first, second) => second.year.localeCompare(first.year));

  return {
    provinces,
    years,
    provinceCount: provinceMap.size,
    cityCount: cityKeys.size,
    placeCount: placeIds.size,
    tripCount: tripIds.size,
    entryCount: entries.length,
    photoCount: photos,
    tripTotal: trips.length,
  };
}

export function StatsPanel({
  places,
  entries,
  trips,
  loading,
  error,
  onRetry,
}: {
  places: Place[];
  entries: EntrySummary[];
  trips: Trip[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const stats = useMemo(() => buildStats(places, entries, trips), [places, entries, trips]);
  const maxYear = Math.max(...stats.years.map((item) => item.count), 1);
  const maxProvince = Math.max(...stats.provinces.map((item) => item.entries), 1);
  const hasData = stats.entryCount > 0;

  return (
    <section aria-label="旅行统计" className="center-panel stats-view floating-panel">
      <header className="stats-view__head">
        <h1>Stats</h1>
        <p>只统计已有简记的真实足迹</p>
      </header>

      <div className="stats-view__scroll">
        {loading && entries.length === 0 ? (
          <div className="stats-skeleton" aria-label="正在加载统计">
            <div className="stats-grid">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <span className="skeleton stats-skeleton__tile" key={item} />
              ))}
            </div>
            <span className="skeleton stats-skeleton__chart" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} title="统计加载失败" />
        ) : !hasData ? (
          <EmptyState
            description="添加第一条简记后，省份、城市和年度分布会在这里出现。"
            icon={<CompassIcon />}
            title="还没有可统计的足迹"
          />
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-tile">
                <span className="stat-tile__icon"><CompassIcon /></span>
                <span className="stat-tile__value">{stats.provinceCount}</span>
                <span className="stat-tile__label">省份</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile__icon"><MapIcon /></span>
                <span className="stat-tile__value">{stats.cityCount}</span>
                <span className="stat-tile__label">城市</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile__icon"><MapPinIcon /></span>
                <span className="stat-tile__value">{stats.placeCount}</span>
                <span className="stat-tile__label">地点</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile__icon"><RouteIcon /></span>
                <span className="stat-tile__value">{stats.tripCount}</span>
                <span className="stat-tile__label">旅行分组</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile__icon"><CalendarIcon /></span>
                <span className="stat-tile__value">{stats.entryCount}</span>
                <span className="stat-tile__label">简记</span>
              </div>
              <div className="stat-tile">
                <span className="stat-tile__icon"><ImageIcon /></span>
                <span className="stat-tile__value">{stats.photoCount}</span>
                <span className="stat-tile__label">照片</span>
              </div>
            </div>

            <div className="stats-panels">
              <section aria-label="年度记录分布" className="stats-card">
                <header className="stats-card__head">
                  <h2>年度记录</h2>
                  <span>{stats.years.length} 个年份</span>
                </header>
                <div className="stat-years">
                  {stats.years.map((item) => (
                    <div className="stat-year" key={item.year}>
                      <span className="stat-year__label">{item.year}</span>
                      <span className="stat-year__track">
                        <span
                          className="stat-year__bar"
                          style={{ width: `${Math.max(6, (item.count / maxYear) * 100)}%` }}
                        />
                      </span>
                      <span className="stat-year__count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-label="省份分布" className="stats-card">
                <header className="stats-card__head">
                  <h2>省份分布</h2>
                  <span>{stats.provinceCount} 个省份</span>
                </header>
                <div className="stat-provinces">
                  {stats.provinces.map((item) => (
                    <div className="stat-province" key={item.key}>
                      <span className="stat-province__label">{item.name}</span>
                      <span className="stat-province__track">
                        <span
                          className="stat-province__bar"
                          style={{ width: `${Math.max(6, (item.entries / maxProvince) * 100)}%` }}
                        />
                      </span>
                      <span className="stat-province__count">
                        {item.entries} 条 · {item.places} 地点
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {stats.tripTotal > stats.tripCount ? (
              <p className="stats-view__note">
                还有 {stats.tripTotal - stats.tripCount} 个旅行分组尚未关联简记，不计入足迹。
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
