import { useEffect, useState, useCallback } from "react";
import { api, extractErrorMessage } from "@/lib/api";

export function useFetch<T>(url: string, params?: Record<string, any>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetcher = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<T>(url, { params });
      setData(res.data);
    } catch (e: any) {
      setError(extractErrorMessage(e, "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, JSON.stringify(params)]);

  useEffect(() => {
    fetcher();
  }, [fetcher]);

  return { data, loading, error, refetch: fetcher };