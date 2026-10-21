function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
}

export function normalizeEntryDates(input) {
  const date = typeof input.date === "string" ? input.date.trim() : input.date;
  const endDate = input.endDate === undefined ? date :
    typeof input.endDate === "string" ? input.endDate.trim() : input.endDate;
  if (!validDate(date) || !validDate(endDate)) {
    throw Object.assign(new Error("请选择有效的起止日期"), { status: 400 });
  }
  if (endDate < date) {
    throw Object.assign(new Error("结束日期不能早于开始日期"), { status: 400 });
  }
  return { date, endDate };
}

export function withEntryDates(entry) {
  return { ...entry, endDate: entry.endDate ?? entry.date };
}
