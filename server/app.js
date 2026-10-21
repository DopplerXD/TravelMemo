import express from "express";
import { mountProfile } from "./profile.js";
import { createPoiSearch } from "./poi.js";
import compression from "compression";
import multer from "multer";
import sharp from "sharp";
import { decodeHeic } from "./heic.js";
import { normalizeEntryDates, withEntryDates } from "./entry-dates.js";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (value, max, required = true) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw fail(400, "字段内容无效");
  return value.trim();
};
const coordinate = (value, limit) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > limit
  )
    throw fail(400, "坐标无效");
  return value;
};
export function createApp(options = {}) {
  const dataDir = path.resolve(
    options.dataDir ?? process.env.DATA_DIR ?? path.join(root, "data"),
  );
  const mediaDir = path.join(dataDir, "media");
  mkdirSync(mediaDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "travelmemo.sqlite"));
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS trips(id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS places(id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY, place_id TEXT NOT NULL REFERENCES places(id), trip_id TEXT REFERENCES trips(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);`);
  const username = options.username ?? process.env.ADMIN_USERNAME;
  const password = options.password ?? process.env.ADMIN_PASSWORD;
  if (!username || !password || password.length < 12) {
    db.close();
    throw new Error(
      "ADMIN_USERNAME and ADMIN_PASSWORD (at least 12 characters) are required",
    );
  }
  const salt = randomBytes(32);
  const passwordHash = scryptSync(password, salt, 64);
  const app = express();
  app.disable("x-powered-by");
  app.use(compression({ level: 4, threshold: 1024 }));
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
    });
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  const get = (table, id) => {
    if (typeof id !== "string" || id.length > 100)
      throw fail(400, "内容标识无效");
    const row = db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id);
    if (!row) throw fail(404, "内容不存在");
    const value = JSON.parse(row.data);
    return table === "entries" ? withEntryDates(value) : value;
  };
  const all = (table) =>
    db
      .prepare(`SELECT data FROM ${table}`)
      .all()
      .map((row) => {
        const value = JSON.parse(row.data);
        return table === "entries" ? withEntryDates(value) : value;
      });
  const cookieId = (req) =>
    req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("travelmemo_session="))
      ?.slice(19);
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const id = cookieId(req);
    req.session = id
      ? db
          .prepare("SELECT * FROM sessions WHERE id=? AND expires>?")
          .get(id, Date.now())
      : null;
    next();
  });
  const sameOrigin = (req) => {
    if (!req.headers.origin) return true;
    try {
      return new URL(req.headers.origin).host === req.headers.host;
    } catch {
      return false;
    }
  };
  const protect = (req, res, next) => {
    if (!req.session) return next(fail(401, "请先登录"));
    if (req.headers["x-csrf-token"] !== req.session.csrf)
      return next(fail(403, "请求验证失败"));
    if (!sameOrigin(req)) return next(fail(403, "请求来源无效"));
    next();
  };
  mountProfile(app, db, protect);
  const cookie = (req, value, maxAge) =>
    `travelmemo_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${options.secureCookies || process.env.COOKIE_SECURE === "true" ? "; Secure" : ""}`;
  const attempts = new Map();
  app.get("/api/map-config", (req, res) => {
    const token = process.env.TDT_TOKEN;
    const custom = process.env.MAP_TILE_URL;
    const tdt = (type) =>
      `https://t0.tianditu.gov.cn/DataServer?T=${type}&x={x}&y={y}&l={z}&tk=${encodeURIComponent(token)}`;
    const maxZoom = Number(process.env.MAP_MAX_ZOOM ?? 18);
    res.json({
      tiles: custom ? [custom] : token ? [tdt("vec_w")] : [],
      overlayTiles: !custom && token ? [tdt("cia_w")] : [],
      attribution: process.env.MAP_ATTRIBUTION ?? (token ? "© 天地图" : ""),
      maxZoom: Number.isFinite(maxZoom)
        ? Math.max(0, Math.min(22, maxZoom))
        : 18,
    });
  });
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.get("/api/session", (req, res) =>
    res.json(
      req.session
        ? { authenticated: true, csrfToken: req.session.csrf }
        : { authenticated: false },
    ),
  );
  app.post("/api/login", (req, res, next) => {
    if (!sameOrigin(req)) return next(fail(403, "请求来源无效"));
    const ip = req.ip;
    for (const [key, value] of attempts)
      if (value.until <= Date.now()) attempts.delete(key);
    const now = Date.now();
    const attempt = attempts.get(ip);
    if (attempt && attempt.until > now && attempt.count >= 10)
      return next(fail(429, "尝试次数过多，请稍后重试"));
    const candidate =
      typeof req.body?.password === "string" && req.body.password.length <= 1024
        ? req.body.password
        : "";
    if (
      req.body?.username !== username ||
      !timingSafeEqual(scryptSync(candidate, salt, 64), passwordHash)
    ) {
      attempts.set(ip, {
        count: attempt?.until > now ? attempt.count + 1 : 1,
        until: now + 900000,
      });
      return next(fail(401, "用户名或密码错误"));
    }
    attempts.delete(ip);
    db.prepare("DELETE FROM sessions WHERE expires<? OR id=?").run(
      now,
      cookieId(req) ?? "",
    );
    const id = randomBytes(32).toString("hex"),
      csrfToken = randomBytes(32).toString("hex");
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      id,
      csrfToken,
      now + 86400000,
    );
    res.setHeader("Set-Cookie", cookie(req, id, 86400));
    res.json({ authenticated: true, csrfToken });
  });
  app.post("/api/logout", protect, (req, res) => {
    db.prepare("DELETE FROM sessions WHERE id=?").run(req.session.id);
    res.setHeader("Set-Cookie", cookie(req, "", 0));
    res.json({ ok: true });
  });
  const searchPoi = createPoiSearch({
    key: options.amapKey ?? process.env.AMAP_WEB_SERVICE_KEY,
    fetchImpl: options.poiFetch ?? fetch,
  });
  app.post("/api/poi/search", protect, async (req, res) => {
    res.json({ places: await searchPoi(req.body) });
  });
  app.get("/api/catalog", (req, res) =>
    res.json({
      trips: all("trips"),
      places: all("places"),
      entries: all("entries")
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(({ body, ...entry }) => entry),
    }),
  );
  app.get("/api/entries/:id", (req, res) =>
    res.json(get("entries", req.params.id)),
  );
  function normalize(collection, input, id) {
    if (!input || typeof input !== "object") throw fail(400, "数据无效");
    if (collection === "trips") {
      if (!Array.isArray(input.cityRoute) || input.cityRoute.length > 200)
        throw fail(400, "城市顺序无效");
      return {
        id,
        title: text(input.title, 200),
        description: text(input.description ?? "", 10000, false),
        cityRoute: input.cityRoute.map((city) => {
          if (!city || typeof city !== "object" || Array.isArray(city))
            throw fail(400, "城市顺序无效");
          return {
            name: text(city.name, 100),
            lng: coordinate(city.lng, 180),
            lat: coordinate(city.lat, 90),
          };
        }),
      };
    }
    if (collection === "places") {
      if (
        typeof input.provinceCode !== "string" ||
        typeof input.cityCode !== "string" ||
        !/^\d{6}$/.test(input.provinceCode) ||
        !/^\d{6}$/.test(input.cityCode) ||
        input.provinceCode.slice(0, 2) !== input.cityCode.slice(0, 2)
      )
        throw fail(400, "行政区代码无效");
      return {
        id,
        name: text(input.name, 200),
        province: text(input.province, 100),
        provinceCode: input.provinceCode,
        city: text(input.city, 100),
        cityCode: input.cityCode,
        lng: coordinate(input.lng, 180),
        lat: coordinate(input.lat, 90),
      };
    }
    const { date, endDate } = normalizeEntryDates(input);
    if (
      typeof input.placeId !== "string" ||
      (input.tripId !== null && typeof input.tripId !== "string")
    )
      throw fail(400, "地点或旅行标识无效");
    get("places", input.placeId);
    if (input.tripId) get("trips", input.tripId);
    if (!Array.isArray(input.photos) || input.photos.length > 50)
      throw fail(400, "照片列表无效");
    const seen = new Set();
    const photos = input.photos.map((photo) => {
      if (!photo || typeof photo !== "object" || Array.isArray(photo))
        throw fail(400, "照片列表无效");
      if (seen.has(photo.id)) throw fail(400, "照片不能重复");
      seen.add(photo.id);
      return {
        ...get("photos", photo.id),
        alt: text(photo.alt ?? "", 500, false),
      };
    });
    return {
      id,
      title: text(input.title, 200),
      date,
      endDate,
      placeId: input.placeId,
      tripId: input.tripId || null,
      body: text(input.body ?? "", 50000, false),
      photos,
    };
  }
  for (const collection of ["trips", "places", "entries"]) {
    const save = (req, res) => {
      const id = req.params.id ?? randomUUID();
      if (req.params.id) get(collection, id);
      const data = normalize(collection, req.body, id);
      if (collection === "entries")
        db.prepare(
          "INSERT INTO entries VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET place_id=excluded.place_id,trip_id=excluded.trip_id,data=excluded.data",
        ).run(id, data.placeId, data.tripId, JSON.stringify(data));
      else
        db.prepare(
          `INSERT INTO ${collection} VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
        ).run(id, JSON.stringify(data));
      res.status(req.params.id ? 200 : 201).json(data);
    };
    app.post(`/api/${collection}`, protect, save);
    app.put(`/api/${collection}/:id`, protect, save);
    app.delete(`/api/${collection}/:id`, protect, (req, res) => {
      get(collection, req.params.id);
      if (
        collection !== "entries" &&
        db
          .prepare(
            `SELECT id FROM entries WHERE ${collection === "places" ? "place_id" : "trip_id"}=? LIMIT 1`,
          )
          .get(req.params.id)
      )
        throw fail(409, "仍有简记使用此内容");
      db.prepare(`DELETE FROM ${collection} WHERE id=?`).run(req.params.id);
      res.json({ ok: true });
    });
  }
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0 },
  });
  app.post("/api/photos", protect, upload.single("file"), async (req, res) => {
    if (!req.file) throw fail(400, "请选择照片");
    const id = randomUUID();
    let display, thumbnail, metadata;
    try {
      let source = sharp(req.file.buffer, {
        limitInputPixels: 50000000,
        animated: false,
      });
      metadata = await source.metadata();
      if (
        !["jpeg", "png", "webp", "heif", "avif", "tiff"].includes(
          metadata.format,
        )
      )
        throw new Error();
      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width * metadata.height > 50000000
      ) {
        throw fail(400, "照片尺寸过大，最多支持 5000 万像素");
      }
      const isHeic = metadata.format === "heif" && metadata.compression === "hevc";
      if (isHeic) {
        const decoded = await decodeHeic(req.file.buffer);
        source = sharp(decoded, { limitInputPixels: 50000000, animated: false });
      }
      display = await source
        .rotate(isHeic ? 0 : undefined)
        .resize({
          width: 2048,
          height: 2048,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      thumbnail = await sharp(display.data)
        .resize({
          width: 480,
          height: 480,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 75 })
        .toBuffer();
    } catch (error) {
      if (error.status) throw error;
      throw fail(400, "照片格式无效、文件损坏或尺寸过大");
    }
    const originalExtension =
      { jpeg: "jpg", heif: "heic" }[metadata.format] ?? metadata.format;
    const files = [
      [`${id}.webp`, display.data],
      [`${id}-thumb.webp`, thumbnail],
      [`${id}-original.${originalExtension}`, req.file.buffer],
    ];
    try {
      for (const [name, content] of files)
        await writeFile(path.join(mediaDir, name), content, { flag: "wx" });
      const photo = {
        id,
        url: `/media/${id}.webp`,
        thumbnailUrl: `/media/${id}-thumb.webp`,
        width: display.info.width,
        height: display.info.height,
        alt: "",
      };
      db.prepare("INSERT INTO photos VALUES(?,?)").run(
        id,
        JSON.stringify(photo),
      );
      res.status(201).json(photo);
    } catch (error) {
      await Promise.all(
        files.map(([name]) =>
          unlink(path.join(mediaDir, name)).catch(() => {}),
        ),
      );
      throw error;
    }
  });
  app.use("/media", (req, res, next) => {
    if (!/^\/[a-f0-9-]+(?:-thumb)?\.webp$/.test(req.path))
      return res.status(404).json({ error: "照片不存在" });
    next();
  });
  app.use(
    "/media",
    express.static(mediaDir, {
      immutable: true,
      maxAge: "1y",
      dotfiles: "deny",
      setHeaders: (res) =>
        res.set("Content-Security-Policy", "default-src 'none'; sandbox"),
    }),
  );
  app.use("/media", (req, res) =>
    res.status(404).json({ error: "照片不存在" }),
  );
  app.use("/api", (req, res) => res.status(404).json({ error: "接口不存在" }));
  const webDir =
    options.webDir ??
    process.env.STATIC_DIR ??
    path.resolve(root, "../web/dist");
  app.use(express.static(webDir));
  app.get("/{*path}", (req, res, next) =>
    res.sendFile(
      "index.html",
      { root: path.resolve(webDir) },
      (error) => error && next(error),
    ),
  );
  app.use((error, req, res, next) => {
    const status =
      error.status ?? (error instanceof multer.MulterError ? 400 : 500);
    if (status >= 500) console.error(error);
    res
      .status(status)
      .json({ error: status >= 500 ? "服务暂时不可用" : error.message });
  });
  return { app, close: () => db.close(), db };
}
