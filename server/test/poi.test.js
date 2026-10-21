import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPoiSearch, gcj02ToWgs84 } from "../poi.js";
import { createApp } from "../app.js";

const poi = { id: "B001", name: "玄武湖公园", address: "玄武巷1号", adname: "玄武区", adcode: "320102", location: "118.802,32.078" };

test("search scopes to city, converts coordinates, filters invalid results and caches", async () => {
  let calls = 0;
  const search = createPoiSearch({ key: "test-key", fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url.origin, "https://restapi.amap.com");
    assert.equal(url.pathname, "/v3/place/text");
    assert.equal(url.searchParams.get("key"), "test-key");
    assert.equal(url.searchParams.get("city"), "320100");
    assert.equal(url.searchParams.get("citylimit"), "true");
    assert.equal(url.searchParams.get("keywords"), "玄武湖");
    assert.ok(options.signal);
    const candidate = { ...poi };
    if (url.searchParams.get("extensions") !== "all") delete candidate.adcode;
    return Response.json({ status: "1", pois: [candidate, { ...poi, id: "outside", adcode: "310101" }, { ...poi, location: "" }, { ...poi, location: "x,y" }, { ...poi, location: "," }] });
  } });
  const results = await search({ keywords: " 玄武湖 ", cityCode: "320100" });
  assert.equal(results.length, 1);
  assert.equal(results[0].name, poi.name);
  assert.ok(results[0].lng < 118.802 && results[0].lng > 118.79);
  assert.deepEqual(await search({ keywords: "玄武湖", cityCode: "320100" }), results);
  assert.equal(calls, 1);
  await assert.rejects(search({ keywords: "新搜索", cityCode: "320100" }), { status: 429 });
});

test("validates parameters and missing key without calling upstream", async () => {
  const search = createPoiSearch({ key: "", fetchImpl: () => { throw Error("unexpected request"); } });
  for (const input of [null, {}, { keywords: " ", cityCode: "320100" }, { keywords: "x", cityCode: "bad" }, { keywords: "x".repeat(81), cityCode: "320100" }]) {
    await assert.rejects(search(input), { status: 400 });
  }
  await assert.rejects(search({ keywords: "湖", cityCode: "320100" }), { status: 503 });
});

test("handles upstream quota, key errors, bad responses and empty results", async () => {
  for (const [response, status] of [
    [{ status: "0", infocode: "10003" }, 429],
    [{ status: "0", infocode: "10001" }, 502],
    [{ status: "1" }, 502],
  ]) {
    const search = createPoiSearch({ key: "key", fetchImpl: async () => Response.json(response) });
    await assert.rejects(search({ keywords: "湖", cityCode: "320100" }), { status });
  }
  const offline = createPoiSearch({ key: "key", fetchImpl: async () => { throw Error("offline"); } });
  await assert.rejects(offline({ keywords: "湖", cityCode: "320100" }), { status: 502 });
  const empty = createPoiSearch({ key: "key", fetchImpl: async () => Response.json({ status: "1", pois: [] }) });
  assert.deepEqual(await empty({ keywords: "湖", cityCode: "320100" }), []);
});

test("municipality accepts districts; WGS84 conversion matches Beijing reference", async () => {
  const search = createPoiSearch({ key: "key", fetchImpl: async () => Response.json({ status: "1", pois: [{ ...poi, adcode: "110108", location: "116.410244499,39.916404282" }] }) });
  assert.equal((await search({ keywords: "公园", cityCode: "110000" })).length, 1);
  const converted = gcj02ToWgs84(116.410244499, 39.916404282);
  assert.ok(Math.abs(converted.lng - 116.404) < 0.00001);
  assert.ok(Math.abs(converted.lat - 39.915) < 0.00001);
  assert.deepEqual(gcj02ToWgs84(-73.9, 40.7), { lng: -73.9, lat: 40.7 });
});

test("POI endpoint requires authentication and CSRF, then result can be saved", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "travelmemo-poi-"));
  let calls = 0;
  const instance = createApp({ dataDir, username: "admin", password: "test-password-2026", amapKey: "private-test-key", poiFetch: async () => {
    calls++;
    return Response.json({ status: "1", pois: [poi] });
  } });
  const server = instance.app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const body = JSON.stringify({ keywords: "玄武湖", cityCode: "320100" });
  try {
    assert.equal((await fetch(base + "/api/poi/search", { method: "POST", headers: { "Content-Type": "application/json" }, body })).status, 401);
    const login = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "test-password-2026" }) });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const { csrfToken } = await login.json();
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
    assert.equal((await fetch(base + "/api/poi/search", { method: "POST", headers, body })).status, 403);
    assert.equal(calls, 0);
    headers["X-CSRF-Token"] = csrfToken;
    const response = await fetch(base + "/api/poi/search", { method: "POST", headers, body });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(JSON.stringify(payload).includes("private-test-key"), false);
    const selected = payload.places[0];
    const saved = await fetch(base + "/api/places", { method: "POST", headers, body: JSON.stringify({ name: selected.name, lng: selected.lng, lat: selected.lat, province: "江苏省", provinceCode: "320000", city: "南京市", cityCode: "320100" }) });
    assert.equal(saved.status, 201);
    assert.equal((await saved.json()).lng, selected.lng);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    instance.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});
