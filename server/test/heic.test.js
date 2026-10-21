import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createApp } from "../app.js";
import { decodeHeic } from "../heic.js";

let decoderAvailable = true;
try {
  execFileSync("heif-convert", ["--help"], { stdio: "ignore" });
} catch {
  decoderAvailable = false;
}
if (process.env.REQUIRE_HEIC === "1") assert.ok(decoderAvailable, "heif-convert is required");

async function uploadHeic(file, expectedWidth, expectedHeight, checkColors = false) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "travelmemo-heic-test-"));
  const instance = createApp({ dataDir, username: "admin", password: "heic-test-password" });
  const server = instance.app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(base + "/api/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "heic-test-password" }),
    });
    const headers = {
      Cookie: login.headers.get("set-cookie").split(";")[0],
      "X-CSRF-Token": (await login.json()).csrfToken,
    };
    const original = await readFile(file);
    const form = new FormData();
    form.set("file", new Blob([original], { type: "application/octet-stream" }), "photo.HEIC");
    const response = await fetch(base + "/api/photos", { method: "POST", headers, body: form });
    assert.equal(response.status, 201, await response.clone().text());
    const photo = await response.json();
    assert.equal(photo.width, expectedWidth);
    assert.equal(photo.height, expectedHeight);
    const display = await fetch(base + photo.url);
    assert.equal(display.headers.get("content-type"), "image/webp");
    const image = Buffer.from(await display.arrayBuffer());
    if (process.env.HEIC_REFERENCE_FILE && file === process.env.HEIC_TEST_FILE) {
      const reference = await sharp(process.env.HEIC_REFERENCE_FILE).rotate().resize(96, 72).removeAlpha().raw().toBuffer();
      const actual = await sharp(image).resize(96, 72).removeAlpha().raw().toBuffer();
      const difference = reference.reduce((sum, value, i) => sum + Math.abs(value - actual[i]), 0) / reference.length;
      assert.ok(difference < 5, `orientation and color match native reference: ${difference}`);
    }
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.width, expectedWidth);
    const thumbnail = await fetch(base + photo.thumbnailUrl);
    assert.equal(thumbnail.status, 200);
    const thumb = await sharp(Buffer.from(await thumbnail.arrayBuffer())).metadata();
    assert.ok(thumb.width <= 480 && thumb.height <= 480);
    assert.deepEqual(await readFile(path.join(dataDir, "media", `${photo.id}-original.heic`)), original);
    assert.equal((await fetch(base + `/media/${photo.id}-original.heic`)).status, 404);
    if (checkColors) {
      const { data, info } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const top = (16 * info.width + 24) * info.channels;
      const bottom = (48 * info.width + 24) * info.channels;
      assert.ok(data[top] > 180 && data[top + 2] < 80, "top remains red");
      assert.ok(data[bottom] < 80 && data[bottom + 2] > 180, "bottom remains blue");
    }
    const bad = new FormData();
    bad.set("file", new Blob([original.subarray(0, 32)], { type: "image/heic" }), "broken.heic");
    assert.equal((await fetch(base + "/api/photos", { method: "POST", headers, body: bad })).status, 400);
    assert.equal((await readdir(path.join(dataDir, "media"))).length, 3);
    assert.equal(instance.db.prepare("SELECT COUNT(*) AS count FROM photos").get().count, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
    instance.close();
    await rm(dataDir, { recursive: true, force: true });
  }
}

test("HEIC upload preserves colors and original, serves WebP and rejects corrupt files", { skip: !decoderAvailable }, async () => {
  for (const fixture of ["photo.heic", "oriented.heic"]) {
    await uploadHeic(new URL(`fixtures/${fixture}`, import.meta.url), 96, 64, true);
  }
});

test("HEIC decoder releases its slot after errors and rejects concurrent work", { skip: !decoderAvailable }, async () => {
  await assert.rejects(decodeHeic(Buffer.from("broken")), { status: 422 });
  const original = await readFile(new URL("fixtures/photo.heic", import.meta.url));
  const first = decodeHeic(original);
  await assert.rejects(decodeHeic(original), { status: 429 });
  assert.equal((await sharp(await first).metadata()).width, 96);
  const savedPath = process.env.PATH;
  try {
    process.env.PATH = "";
    await assert.rejects(decodeHeic(original), error => error.status === 422 && error.message.includes("未配置"));
  } finally {
    process.env.PATH = savedPath;
  }
  assert.equal((await sharp(await decodeHeic(original)).metadata()).height, 64);
});

test("user-provided iPhone HEIC uploads at display resolution", { skip: !process.env.HEIC_TEST_FILE }, async () => {
  await uploadHeic(process.env.HEIC_TEST_FILE, 2048, 1536);
});
