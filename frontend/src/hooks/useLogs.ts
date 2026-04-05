import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { PaginatedResponse, TrafficHistory } from "@/types";

export function useLogs() {
  const [traffic, setTraffic] = useState<TrafficHistory[]>([]);
  const [systemLogs, setSystemLogs] = useState<PaginatedResponse<
    Record<string, unknown>
  > | null>(null);
  const [days, setDays] = useState(7);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTraffic = useCallback(
    async (deviceId?: number) => {
      try {
        setIsLoading(true);
        setError(null);
        const params = new URLSearchParams({ days: String(days) });
        if (deviceId !== undefined) params.set("device_id", String(deviceId));
        const data = await api.get<TrafficHistory[]>(`/logs/traffic?${params}`);
        setTraffic(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load traffic history",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [days],
  );

  const fetchSystemLogs = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<PaginatedResponse<Record<string, unknown>>>(
        `/logs/system?page=${page}&limit=20`,
      );
      setSystemLogs(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load system logs",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const purge = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await api.delete("/logs/purge");
      setTraffic([]);
      setSystemLogs(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purge failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    traffic,
    systemLogs,
    days,
    setDays,
    isLoading,
    error,
    fetchTraffic,
    fetchSystemLogs,
    purge,
  };
}
