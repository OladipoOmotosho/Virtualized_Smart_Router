import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import type { PaginatedResponse, TrafficHistory } from "@/types";

export function useLogs() {
  const toast = useToast();
  const [traffic, setTraffic] = useState<TrafficHistory[]>([]);
  const [systemLogs, setSystemLogs] = useState<PaginatedResponse<
    Record<string, unknown>
  > | null>(null);
  const [days, setDays] = useState(7);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTraffic = useCallback(
    async (deviceId?: number) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({ days: String(days) });
        if (deviceId !== undefined) params.set("device_id", String(deviceId));
        const data = await api.get<TrafficHistory[]>(`/logs/traffic?${params}`);
        setTraffic(data);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load traffic history",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [days, toast],
  );

  const fetchSystemLogs = useCallback(
    async (page = 1) => {
      try {
        setIsLoading(true);
        const data = await api.get<PaginatedResponse<Record<string, unknown>>>(
          `/logs/system?page=${page}&limit=20`,
        );
        setSystemLogs(data);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load system logs",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  const purge = useCallback(
    async (options?: {
      scope?: "traffic" | "alerts" | "both";
      olderThanDays?: number | null;
    }) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (options?.scope) params.set("scope", options.scope);
        if (
          options?.olderThanDays !== undefined &&
          options?.olderThanDays !== null
        ) {
          params.set("older_than_days", String(options.olderThanDays));
        }
        const qs = params.toString();
        const result = await api.delete<{ deleted_count: number; message: string }>(
          qs ? `/logs/purge?${qs}` : "/logs/purge",
        );
        setTraffic([]);
        setSystemLogs(null);
        return result;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Purge failed");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  return {
    traffic,
    systemLogs,
    days,
    setDays,
    isLoading,
    fetchTraffic,
    fetchSystemLogs,
    purge,
  };
}
