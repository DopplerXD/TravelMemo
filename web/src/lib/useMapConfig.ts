import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { MapConfig } from "../types";

export const EMPTY_MAP_CONFIG: MapConfig = {
  tiles: [],
  overlayTiles: [],
  attribution: "",
  maxZoom: 18,
};

const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  value: MapConfig;
  at: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<MapConfig> | null = null;

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function normalizeConfig(raw: unknown): MapConfig {
  const value = (raw ?? {}) as Record<string, unknown>;
  const maxZoom = Number(value.maxZoom);
  return {
    tiles: stringList(value.tiles),
    overlayTiles: stringList(value.overlayTiles),
    attribution: typeof value.attribution === "string" ? value.attribution.trim() : "",
    maxZoom: Number.isFinite(maxZoom) ? Math.min(22, Math.max(1, maxZoom)) : 18,
  };
}

export function loadMapConfig(force = false): Promise<MapConfig> {
  if (force) {
    cache = null;
    inflight = null;
  }
  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return Promise.resolve(cache.value);
  }
  if (!inflight) {
    inflight = api
      .mapConfig()
      .then((raw) => {
        const value = normalizeConfig(raw);
        cache = { value, at: Date.now() };
        inflight = null;
        return value;
      })
      .catch((error: unknown) => {
        inflight = null;
        throw error;
      });
  }
  return inflight;
}

export interface MapConfigState {
  config: MapConfig;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Reads the runtime basemap configuration from the API once per session.
 * A failed request never blocks the map: callers fall back to the local
 * administrative view and can retry through the returned callback.
 */
export function useMapConfig(): MapConfigState {
  const [config, setConfig] = useState<MapConfig>(() => cache?.value ?? EMPTY_MAP_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !cache);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadMapConfig(attempt > 0)
      .then((value) => {
        if (cancelled) return;
        setConfig(value);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "底图配置加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { config, loading, error, retry };
}
