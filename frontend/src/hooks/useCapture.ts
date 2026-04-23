import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import type { CaptureSession, CaptureStartRequest, PcapFile } from "@/types";

export function useCapture() {
  const toast = useToast();
  const [sessions, setSessions] = useState<CaptureSession[]>([]);
  const [files, setFiles] = useState<PcapFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const startCapture = useCallback(
    async (req: CaptureStartRequest) => {
      try {
        setIsLoading(true);
        const started = await api.post<CaptureSession[]>(
          "/packet-capture/start",
          req,
        );
        setSessions((prev) => [...prev, ...started]);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to start capture",
        );
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  const stopCapture = useCallback(
    async (deviceId: number) => {
      try {
        await api.post("/packet-capture/stop", { device_id: deviceId });
        setSessions((prev) =>
          prev.map((s) =>
            s.device_id === deviceId && !s.stopped_at
              ? { ...s, stopped_at: new Date().toISOString() }
              : s,
          ),
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to stop capture",
        );
        throw err;
      }
    },
    [toast],
  );

  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<PcapFile[]>("/packet-capture/files");
      setFiles(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const deleteFile = useCallback(
    async (filename: string) => {
      try {
        await api.delete(`/packet-capture/files/${encodeURIComponent(filename)}`);
        setFiles((prev) => prev.filter((f) => f.filename !== filename));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete file",
        );
      }
    },
    [toast],
  );

  return {
    sessions,
    files,
    isLoading,
    startCapture,
    stopCapture,
    fetchFiles,
    deleteFile,
  };
}
