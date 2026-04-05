import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { CaptureSession, CaptureStartRequest, PcapFile } from "@/types";

export function useCapture() {
  const [sessions, setSessions] = useState<CaptureSession[]>([]);
  const [files, setFiles] = useState<PcapFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCapture = useCallback(async (req: CaptureStartRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      const started = await api.post<CaptureSession[]>("/packet-capture/start", req);
      setSessions((prev) => [...prev, ...started]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start capture");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopCapture = useCallback(async (deviceId: number) => {
    try {
      await api.post("/packet-capture/stop", { device_id: deviceId });
      setSessions((prev) =>
        prev.map((s) =>
          s.device_id === deviceId && !s.stopped_at
            ? { ...s, stopped_at: new Date().toISOString() }
            : s
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop capture");
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<PcapFile[]>("/packet-capture/files");
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteFile = useCallback(async (filename: string) => {
    try {
      await api.delete(`/packet-capture/files/${encodeURIComponent(filename)}`);
      setFiles((prev) => prev.filter((f) => f.filename !== filename));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete file");
    }
  }, []);

  return { sessions, files, isLoading, error, startCapture, stopCapture, fetchFiles, deleteFile };
}
