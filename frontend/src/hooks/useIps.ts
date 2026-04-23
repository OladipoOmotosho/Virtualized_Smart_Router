import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import type { IpsAlert, IpsStatus } from "@/types";

const POLL_INTERVAL_MS = 10_000;

export function useIps() {
  const toast = useToast();
  const [status, setStatus] = useState<IpsStatus | null>(null);
  const [alerts, setAlerts] = useState<IpsAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<IpsStatus>("/ips/status");
      setStatus(data);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load IPS status",
      );
    }
  }, [toast]);

  const fetchAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<IpsAlert[]>("/ips/alerts");
      setAlerts(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Auto-refresh alerts on a polling interval
  useEffect(() => {
    fetchStatus();
    fetchAlerts();
    const id = setInterval(() => {
      fetchStatus();
      fetchAlerts();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchStatus, fetchAlerts]);

  return { status, alerts, isLoading, fetchAlerts };
}
