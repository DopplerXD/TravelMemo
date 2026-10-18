const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export interface ParsedDate {
  year: string;
  month: string;
  day: string;
  monthDay: string;
  full: string;
  weekday: string;
  isValid: boolean;
}

export function parseDate(value: string): ParsedDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return {
      year: "",
      month: "",
      day: "",
      monthDay: value || "日期待定",
      full: value || "日期待定",
      weekday: "",
      isValid: false,
    };
  }

  const [, year = "", month = "", day = ""] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const isValid =
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);

  return {
    year,
    month,
    day,
    monthDay: `${Number(month)}月${Number(day)}日`,
    full: `${year}年${Number(month)}月${Number(day)}日`,
    weekday: isValid ? WEEKDAYS[date.getDay()] ?? "" : "",
    isValid,
  };
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatRelativeYear(year: string): string {
  const current = new Date().getFullYear().toString();
  return year === current ? "今年" : `${year} 年`;
}

export function formatDateRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return "日期待定";
  const first = parseDate(start ?? end ?? "");
  const last = parseDate(end ?? start ?? "");
  if (!first.isValid && !last.isValid) return start || end || "日期待定";
  if (!last.isValid || start === end) return first.full;
  if (!first.isValid) return last.full;
  if (first.year === last.year) {
    if (first.month === last.month) {
      return `${first.year}年${Number(first.month)}月${Number(first.day)}日–${Number(last.day)}日`;
    }
    return `${first.year}年${Number(first.month)}月${Number(first.day)}日–${Number(last.month)}月${Number(last.day)}日`;
  }
  return `${first.full} – ${last.full}`;
}

export function pluralRecords(count: number): string {
  return `${count} 条记录`;
}

export function pluralPlaces(count: number): string {
  return `${count} 个地点`;
}

export function pluralPhotos(count: number): string {
  return `${count} 张照片`;
}
