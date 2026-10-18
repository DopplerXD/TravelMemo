import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createApp } from "../app.js";

test("authentication, CRUD, images, references and restart persistence", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "travelmemo-"));
  let instance, server, base;
  async function start() {
    instance = createApp({
      dataDir,
      username: "admin",
      password: "a-long-test-password",
    });
    server = instance.app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    instance.close();
  }
  let cookie, csrf;
  const request = (
    url,
    method = "GET",
    body,
    authenticated = true,
    token = csrf,
  ) =>
    fetch(base + url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(authenticated && cookie
          ? { Cookie: cookie, "X-CSRF-Token": token }
          : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    await start();
    assert.equal((await request("/api/health")).status, 200);
    assert.deepEqual(
      (await (await request("/api/map-config")).json()).tiles,
      [],
    );
    assert.equal(
      (await fetch(base + "/api/photos", { method: "POST" })).status,
      401,
    );
    assert.deepEqual(await (await request("/api/catalog")).json(), {
      trips: [],
      places: [],
      entries: [],
    });
    assert.equal((await request("/api/trips", "POST", {}, false)).status, 401);
    assert.equal(
      (
        await request("/api/login", "POST", {
          username: "admin",
          password: "wrong",
        })
      ).status,
      401,
    );
    const login = await request("/api/login", "POST", {
      username: "admin",
      password: "a-long-test-password",
    });
    cookie = login.headers.get("set-cookie").split(";")[0];
    csrf = (await login.json()).csrfToken;
    assert.match(cookie, /travelmemo_session=/);
    assert.equal(
      (await request("/api/trips", "POST", {}, true, "bad")).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/trips", {
          method: "POST",
          headers: {
            Cookie: cookie,
            "X-CSRF-Token": csrf,
            Origin: "https://other.example",
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    const invalidImage = new FormData();
    invalidImage.set("file", new Blob(["<svg/>"]), "image.svg");
    assert.equal(
      (
        await fetch(base + "/api/photos", {
          method: "POST",
          headers: { Cookie: cookie, "X-CSRF-Token": csrf },
          body: invalidImage,
        })
      ).status,
      400,
    );
    const trip = await (
      await request("/api/trips", "POST", {
        title: "江南旅行",
        description: "",
        cityRoute: [],
      })
    ).json();
    const place = await (
      await request("/api/places", "POST", {
        name: "南京",
        province: "江苏省",
        provinceCode: "320000",
        city: "南京市",
        cityCode: "320100",
        lng: 118.79,
        lat: 32.06,
      })
    ).json();
    const form = new FormData();
    form.set(
      "file",
      new Blob(
        [
          await sharp({
            create: { width: 100, height: 80, channels: 3, background: "#fff" },
          })
            .png()
            .toBuffer(),
        ],
        { type: "image/png" },
      ),
      "photo.png",
    );
    const upload = await fetch(base + "/api/photos", {
      method: "POST",
      headers: { Cookie: cookie, "X-CSRF-Token": csrf },
      body: form,
    });
    assert.equal(upload.status, 201);
    const photo = await upload.json();
    assert.equal(photo.width, 100);
    const image = await fetch(base + photo.url, {
      headers: { "Accept-Encoding": "gzip" },
    });
    assert.equal(image.headers.get("content-encoding"), null);
    assert.equal(
      (await fetch(base + `/media/${photo.id}-original.png`)).status,
      404,
    );
    assert.equal(
      (await fetch(base + `/media/${photo.id}-%6Friginal.png`)).status,
      404,
    );
    assert.equal((await fetch(base + photo.thumbnailUrl)).status, 200);
    const entryInput = {
      title: "旧城",
      date: "2026-10-18",
      placeId: place.id,
      tripId: trip.id,
      body: "沿河散步",
      photos: [
        { ...photo, url: "https://other.example/tracking", alt: "河边" },
      ],
    };
    for (const invalid of [
      { ...entryInput, photos: [null] },
      { ...entryInput, photos: ["bad"] },
      { ...entryInput, tripId: {} },
      { ...entryInput, placeId: [] },
    ])
      assert.equal(
        (await request("/api/entries", "POST", invalid)).status,
        400,
      );
    for (const cityRoute of [[null], [3], ["bad"]])
      assert.equal(
        (await request("/api/trips", "POST", { title: "旅行", cityRoute }))
          .status,
        400,
      );
    for (const invalid of [
      { ...place, provinceCode: 320000 },
      { ...place, cityCode: 320100 },
      { ...place, cityCode: "110100" },
    ])
      assert.equal((await request("/api/places", "POST", invalid)).status, 400);
    const saved = await request("/api/entries", "POST", entryInput);
    assert.equal(saved.status, 201);
    const entry = await saved.json();
    assert.equal(entry.photos[0].url, photo.url);
    assert.equal(
      (
        await request("/api/entries", "POST", {
          ...entryInput,
          photos: [{ id: "missing", alt: "" }],
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request("/api/entries", "POST", {
          ...entryInput,
          date: "2026-02-30",
        })
      ).status,
      400,
    );
    assert.equal(
      (await request(`/api/places/${place.id}`, "DELETE")).status,
      409,
    );
    assert.equal(
      (await request(`/api/trips/${trip.id}`, "DELETE")).status,
      409,
    );
    assert.equal(
      (await (await request("/api/catalog")).json()).entries[0].body,
      undefined,
    );
    await stop();
    await start();
    assert.equal(
      (await (await request(`/api/entries/${entry.id}`)).json()).body,
      "沿河散步",
    );
    assert.equal((await fetch(base + photo.url)).status, 200);
    assert.equal(
      (await (await request("/api/session")).json()).authenticated,
      true,
    );
    assert.equal(
      (
        await request(`/api/entries/${entry.id}`, "PUT", {
          ...entryInput,
          body: "更新",
        })
      ).status,
      200,
    );
    assert.equal(
      (await request(`/api/entries/${entry.id}`, "DELETE")).status,
      200,
    );
    assert.equal(
      (await request(`/api/places/${place.id}`, "DELETE")).status,
      200,
    );
    assert.equal(
      (await request(`/api/trips/${trip.id}`, "DELETE")).status,
      200,
    );
    assert.equal((await request("/api/logout", "POST")).status, 200);
    assert.equal(
      (await request("/api/trips", "POST", { title: "x", cityRoute: [] }))
        .status,
      401,
    );
  } finally {
    if (server?.listening) await stop();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("login limits separate clients behind the configured proxy", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "travelmemo-proxy-"));
  const previous = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = "1";
  const instance = createApp({
    dataDir,
    username: "admin",
    password: "a-long-test-password",
  });
  if (previous === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = previous;
  const server = instance.app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const login = (ip) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ username: "admin", password: "wrong" }),
    });
  try {
    for (let i = 0; i < 10; i++)
      assert.equal((await login("192.0.2.1")).status, 401);
    assert.equal((await login("192.0.2.1")).status, 429);
    assert.equal((await login("192.0.2.2")).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    instance.close();
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("SPA routes work inside hidden directories and missing media stays 404", async () => {
  const temporaryDir = await mkdtemp(path.join(tmpdir(), "travelmemo-static-"));
  const webDir = path.join(temporaryDir, ".worktrees", "web", "dist");
  await mkdir(webDir, { recursive: true });
  const script = "const place = '南京';\n".repeat(200);
  const geojson = JSON.stringify({
    type: "FeatureCollection",
    features: Array.from({ length: 100 }, () => ({
      type: "Feature",
      properties: { name: "南京" },
      geometry: { type: "Point", coordinates: [118.79, 32.06] },
    })),
  });
  await writeFile(path.join(webDir, "app.js"), script);
  await writeFile(path.join(webDir, "provinces.geojson"), geojson);
  await writeFile(
    path.join(webDir, "index.html"),
    "<!doctype html><title>TravelMemo</title>",
  );
  const instance = createApp({
    dataDir: path.join(temporaryDir, "data"),
    webDir,
    username: "admin",
    password: "a-long-test-password",
  });
  const server = instance.app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ["/", "/admin", "/entries/example"]) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.match(response.headers.get("content-type"), /text\/html/);
      assert.match(await response.text(), /TravelMemo/);
    }
    for (const [asset, expected] of [
      ["app.js", script],
      ["provinces.geojson", geojson],
    ]) {
      const compressed = await fetch(base + "/" + asset, {
        headers: { "Accept-Encoding": "gzip" },
      });
      assert.equal(compressed.status, 200);
      assert.equal(compressed.headers.get("content-encoding"), "gzip");
      assert.match(compressed.headers.get("vary"), /Accept-Encoding/);
      assert.equal(await compressed.text(), expected);
    }
    const privateSession = await fetch(base + "/api/session", {
      headers: { "Accept-Encoding": "gzip" },
    });
    assert.equal(privateSession.headers.get("cache-control"), "no-store");
    const media = await fetch(
      base + "/media/00000000-0000-0000-0000-000000000000.webp",
    );
    assert.equal(media.status, 404);
    assert.match(media.headers.get("content-type"), /application\/json/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    instance.close();
    await rm(temporaryDir, { recursive: true, force: true });
  }
});
