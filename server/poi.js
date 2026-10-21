const fail = (status, message) => Object.assign(new Error(message), { status });

export function gcj02ToWgs84(lng, lat) {
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return { lng, lat };
  const offset = (longitude, latitude) => {
    const x = longitude - 105, y = latitude - 35, pi = Math.PI;
    let dy = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    let dx = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    const wave = (20 * Math.sin(6 * x * pi) + 20 * Math.sin(2 * x * pi)) * 2 / 3;
    dy += wave + (20 * Math.sin(y * pi) + 40 * Math.sin(y / 3 * pi)) * 2 / 3
      + (160 * Math.sin(y / 12 * pi) + 320 * Math.sin(y * pi / 30)) * 2 / 3;
    dx += wave + (20 * Math.sin(x * pi) + 40 * Math.sin(x / 3 * pi)) * 2 / 3
      + (150 * Math.sin(x / 12 * pi) + 300 * Math.sin(x / 30 * pi)) * 2 / 3;
    const rad = latitude * pi / 180;
    const magic = 1 - 0.006693421622965943 * Math.sin(rad) ** 2;
    const root = Math.sqrt(magic);
    return {
      lng: dx * 180 / (6378245 / root * Math.cos(rad) * pi),
      lat: dy * 180 / (6378245 * (1 - 0.006693421622965943) / (magic * root) * pi),
    };
  };
  let result = { lng, lat };
  for (let i = 0; i < 5; i++) {
    const delta = offset(result.lng, result.lat);
    result = { lng: lng - delta.lng, lat: lat - delta.lat };
  }
  return { lng: Number(result.lng.toFixed(6)), lat: Number(result.lat.toFixed(6)) };
}

export function createPoiSearch({ key, fetchImpl = fetch }) {
  const cache = new Map();
  let lastRequest = 0;
  return async (input) => {
    const { keywords, cityCode } = input ?? {};
    if (typeof keywords !== "string" || !keywords.trim() || keywords.trim().length > 80 ||
        typeof cityCode !== "string" || !/^\d{6}$/.test(cityCode)) {
      throw fail(400, "请填写地点关键词并选择城市");
    }
    if (!key) throw fail(503, "地点搜索尚未配置，请联系管理员");
    const query = keywords.trim();
    const cacheKey = `${cityCode}:${query}`;
    const now = Date.now();
    for (const [id, entry] of cache) if (entry.expires <= now) cache.delete(id);
    if (cache.has(cacheKey)) return cache.get(cacheKey).places;
    if (now - lastRequest < 1000) throw fail(429, "搜索过于频繁，请稍后重试");
    lastRequest = now;
    const url = new URL("https://restapi.amap.com/v3/place/text");
    url.search = new URLSearchParams({ key, keywords: query, city: cityCode, citylimit: "true", offset: "10", page: "1", extensions: "all", output: "JSON" });
    let data;
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error();
      data = await response.json();
    } catch {
      throw fail(502, "地点搜索暂不可用，请稍后重试");
    }
    if (data?.status !== "1") {
      if (["10003", "10004", "10021", "10044"].includes(data?.infocode)) {
        throw fail(429, "地点搜索额度或频率已达上限，请稍后重试");
      }
      throw fail(502, "地点搜索服务异常，请管理员检查高德 Key 与服务权限");
    }
    if (!Array.isArray(data.pois)) throw fail(502, "地点搜索结果异常，请稍后重试");
    const str = (value) => typeof value === "string" ? value : "";
    const places = data.pois.flatMap((poi) => {
      if (!poi || typeof poi.location !== "string" || !poi.location.includes(",")) return [];
      const parts = poi.location.split(",");
      if (parts.length !== 2 || parts.some((part) => !part.trim())) return [];
      const [lng, lat] = parts.map(Number);
      const adcode = str(poi.adcode);
      const municipality = ["11", "12", "31", "50"].includes(cityCode.slice(0, 2));
      const inCity = municipality ? adcode.slice(0, 2) === cityCode.slice(0, 2) : adcode.slice(0, 4) === cityCode.slice(0, 4);
      if (!str(poi.id) || !str(poi.name) || !/^\d{6}$/.test(adcode) || !inCity ||
          !Number.isFinite(lng) || !Number.isFinite(lat) || lng < 70 || lng > 140 || lat < 0 || lat > 56) return [];
      return [{ id: poi.id, name: poi.name, address: str(poi.address), district: str(poi.adname), ...gcj02ToWgs84(lng, lat) }];
    });
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(cacheKey, { places, expires: Date.now() + 600000 });
    return places;
  };
}
