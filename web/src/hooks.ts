import { useCallback, useEffect, useState } from "react";
import type { ServiceResult } from "./types/domain";

export function useAsyncData<T>(
  loader: () => Promise<ServiceResult<T>>,
  deps: readonly unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await loader();
    if (result.ok) {
      setData(result.data);
      setError("");
    } else {
      setError(result.error.message);
    }
    setLoading(false);
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

export function formatBytes(value?: number) {
  if (!Number.isFinite(value) || !value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
