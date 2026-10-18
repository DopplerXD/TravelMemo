import { useCallback, useEffect, useState } from "react";
import {
  loadCities,
  loadProvinces,
  type AdministrativeCollection,
} from "./geo";

interface GeoState {
  data: AdministrativeCollection | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useProvinces(): GeoState {
  const [data, setData] = useState<AdministrativeCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadProvinces(version > 0)
      .then((collection) => {
        if (active) setData(collection);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "行政区数据加载失败");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  const retry = useCallback(() => setVersion((value) => value + 1), []);
  return { data, loading, error, retry };
}

export function useCities(provinceCode: string): GeoState {
  const [data, setData] = useState<AdministrativeCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!provinceCode) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    loadCities(provinceCode, version > 0)
      .then((collection) => {
        if (active) setData(collection);
      })
      .catch((reason: unknown) => {
        if (active) {
          setData(null);
          setError(reason instanceof Error ? reason.message : "城市数据加载失败");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provinceCode, version]);

  const retry = useCallback(() => setVersion((value) => value + 1), []);
  return { data, loading, error, retry };
}
