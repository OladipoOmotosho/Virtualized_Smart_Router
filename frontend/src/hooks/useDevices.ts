import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { Device, DeviceUpdate } from "@/types";

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<Device[]>("/devices/");
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const scanDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.post<Device[]>("/devices/scan");
      setDevices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateDevice = useCallback(async (id: number, patch: DeviceUpdate) => {
    try {
      const updated = await api.patch<Device>(`/devices/${id}`, patch);
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }, []);

  return { devices, isLoading, error, fetchDevices, scanDevices, updateDevice };
}
