import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import type { Catalog } from "../types";

interface CatalogState {
  data: Catalog | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (catalog: Catalog) => void;
}

export function useCatalog(enabled = true): CatalogState {
  const [data, setData] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    api
      .catalog(controller.signal)
      .then((catalog) => {
        if (controller.signal.aborted) return;
        setData(catalog);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : "内容加载失败，请稍后重试",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [enabled, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { data, loading, error, reload, setData };
}
