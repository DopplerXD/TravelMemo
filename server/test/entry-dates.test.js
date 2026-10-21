import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEntryDates, withEntryDates } from "../entry-dates.js";

test("entry date ranges accept leap days and default omitted end dates", () => {
  assert.deepEqual(normalizeEntryDates({ date: "2024-02-29" }), { date: "2024-02-29", endDate: "2024-02-29" });
  assert.deepEqual(normalizeEntryDates({ date: "2026-12-31", endDate: "2027-01-02" }), { date: "2026-12-31", endDate: "2027-01-02" });
  for (const dates of [
    { date: "2026-02-29" },
    { date: "2026-04-31" },
    { date: "2026-10-21", endDate: "2026-10-20" },
    { date: "2026-10-21", endDate: "2026-11-31" },
    { date: "2026-10-21", endDate: null },
    { date: "2026-10-21", endDate: "2026-10-22T00:00:00Z" },
  ]) assert.throws(() => normalizeEntryDates(dates), { status: 400 });
  const legacy = { id: "legacy", date: "2025-05-01" };
  assert.deepEqual(withEntryDates(legacy), { ...legacy, endDate: legacy.date });
  assert.equal(legacy.endDate, undefined);
});
