import type { EntrySummary, Photo, Place, Trip } from "../types";
import { parseDate } from "./date";

export interface TripSummary {
  trip: Trip;
  entries: EntrySummary[];
  startDate: string | null;
  endDate: string | null;
  cover: Photo | null;
  cityCount: number;
  placeCount: number;
  latestDate: string;
}

export function buildTripSummaries(
  trips: Trip[],
  entries: EntrySummary[],
  placesById: Map<string, Place>,
): TripSummary[] {
  const entriesByTrip = new Map<string, EntrySummary[]>();
  for (const entry of entries) {
    if (!entry.tripId) continue;
    const list = entriesByTrip.get(entry.tripId) ?? [];
    list.push(entry);
    entriesByTrip.set(entry.tripId, list);
  }

  return trips
    .map((trip): TripSummary => {
      const tripEntries = (entriesByTrip.get(trip.id) ?? []).sort(
        (first, second) =>
          second.date.localeCompare(first.date) || second.id.localeCompare(first.id),
      );
      const dated = tripEntries.filter((entry) => parseDate(entry.date).isValid);
      const ascending = [...dated].sort((first, second) =>
        first.date.localeCompare(second.date),
      );
      const endDates = dated.map((entry) => entry.endDate ?? entry.date).sort();
      const cities = new Set<string>();
      const placeIds = new Set<string>();
      for (const entry of tripEntries) {
        placeIds.add(entry.placeId);
        const place = placesById.get(entry.placeId);
        const city = place?.city?.trim() || place?.province?.trim();
        if (city) cities.add(city);
      }
      for (const city of trip.cityRoute) {
        if (city.name.trim()) cities.add(city.name.trim());
      }
      const cover =
        tripEntries.find((entry) => entry.photos.length > 0)?.photos[0] ?? null;
      return {
        trip,
        entries: tripEntries,
        startDate: ascending[0]?.date ?? null,
        endDate: endDates.at(-1) ?? null,
        cover,
        cityCount: cities.size,
        placeCount: placeIds.size,
        latestDate: ascending[ascending.length - 1]?.date ?? "",
      };
    })
    .sort((first, second) => {
      if (first.latestDate !== second.latestDate) {
        return second.latestDate.localeCompare(first.latestDate);
      }
      return first.trip.title.localeCompare(second.trip.title, "zh-CN");
    });
}

export function tripYear(summary: TripSummary): string {
  const date = summary.latestDate || summary.startDate || summary.endDate;
  if (!date) return "暂无简记";
  return parseDate(date).year || "暂无简记";
}
