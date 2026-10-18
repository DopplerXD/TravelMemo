import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { Entry } from "../types";

export function useEntryDetail(entryId: string | null) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!entryId) {
      setEntry(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setEntry(null);
    api
      .entry(entryId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setEntry(data);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof ApiError ? reason.message : "简记加载失败，请稍后重试",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [entryId, version]);

  return {
    entry,
    loading,
    error,
    retry: () => setVersion((value) => value + 1),
  };
}
