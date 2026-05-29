import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Method = "post" | "put" | "delete" | "patch";

export function useMutation<TBody = any, TResp = any>(
  method: Method,
  path: string | ((args: TBody) => string),
  opts?: { onSuccess?: (data: TResp) => void; successMessage?: string },
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (body?: TBody): Promise<TResp | null> => {
      setLoading(true);
      setError(null);
      try {
        const url = typeof path === "function" ? path(body as TBody) : path;
        const res = await api.request<TResp>({ url, method, data: body });
        if (opts?.successMessage) toast.success(opts.successMessage);
        opts?.onSuccess?.(res.data);
        return res.data;
      } catch (e: any) {
        const msg = e?.response?.data?.error || e?.message || "Erro";
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [method, typeof path === "string" ? path : ""],
  );

  return { mutate, loading, error };
}
