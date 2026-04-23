import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import type { Device, DeviceUpdate } from "@/types";

export function useDevices() {
  const toast = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<Device[]>("/devices/");
      setDevices(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const scanDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.post<Device[]>("/devices/scan");
      setDevices(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const updateDevice = useCallback(
    async (id: number, patch: DeviceUpdate) => {
      try {
        const updated = await api.patch<Device>(`/devices/${id}`, patch);
        setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Update failed");
        return false;
      }
    },
    [toast],
  );

  const deleteDevice = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/devices/${id}`);
        setDevices((prev) => prev.filter((d) => d.id !== id));
        toast.success("Device removed");
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete device",
        );
        return false;
      }
    },
    [toast],
  );

  const deleteAllDevices = useCallback(async () => {
    try {
      const result = await api.delete<{
        deleted_count: number;
        message: string;
      }>("/devices/");
      setDevices([]);
      toast.success(result?.message ?? "All devices cleared");
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to clear devices",
      );
      return false;
    }
  }, [toast]);

  return {
    devices,
    isLoading,
    fetchDevices,
    scanDevices,
    updateDevice,
    deleteDevice,
    deleteAllDevices,
  };
}
