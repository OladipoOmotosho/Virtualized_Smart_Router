import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Play, Square, Trash2 } from "lucide-react";
import { useCapture } from "@/hooks/useCapture";
import { useDevices } from "@/hooks/useDevices";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { formatBytes, formatTimestamp } from "@/lib/utils";

export default function CapturePage() {
  const {
    files,
    isLoading,
    error,
    startCapture,
    stopCapture,
    fetchFiles,
    deleteFile,
  } = useCapture();
  const { devices, fetchDevices } = useDevices();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeIds, setActiveIds] = useState<number[]>([]);
  const [captureEndsAtMs, setCaptureEndsAtMs] = useState<number | null>(null);
  const [captureDurationSeconds, setCaptureDurationSeconds] = useState<
    number | null
  >(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [duration, setDuration] = useState("");
  const [packetCount, setPacketCount] = useState("");
  const refreshTimeoutIdsRef = useRef<number[]>([]);
  const autoStopTimeoutByDeviceRef = useRef<Map<number, number>>(new Map());

  const ringRadius = 28;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const hasCountdown =
    countdownSeconds !== null &&
    captureDurationSeconds !== null &&
    captureDurationSeconds > 0;
  const countdownProgress = hasCountdown
    ? Math.max(0, Math.min(1, countdownSeconds / captureDurationSeconds))
    : 0;
  const ringDashOffset = ringCircumference * (1 - countdownProgress);

  useEffect(() => {
    fetchDevices();
    fetchFiles();
  }, [fetchDevices, fetchFiles]);

  useEffect(() => {
    return () => {
      refreshTimeoutIdsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      refreshTimeoutIdsRef.current = [];

      autoStopTimeoutByDeviceRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      autoStopTimeoutByDeviceRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!captureEndsAtMs || activeIds.length === 0) {
      setCountdownSeconds(null);
      return;
    }

    const updateCountdown = () => {
      const secondsRemaining = Math.max(
        0,
        Math.ceil((captureEndsAtMs - Date.now()) / 1000),
      );
      setCountdownSeconds(secondsRemaining);
      if (secondsRemaining === 0) {
        setCaptureEndsAtMs(null);
      }
    };

    updateCountdown();
    const timerId = window.setInterval(updateCountdown, 1000);

    return () => window.clearInterval(timerId);
  }, [captureEndsAtMs, activeIds.length]);

  function toggleDevice(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function getDeviceLabel(id: number) {
    return devices.find((device) => device.id === id)?.name ?? `Device #${id}`;
  }

  async function handleStart() {
    if (!selectedIds.length) return;
    const parsedDuration = duration ? Number(duration) : undefined;
    const parsedPacketCount = packetCount ? Number(packetCount) : undefined;

    try {
      await startCapture({
        device_ids: selectedIds,
        duration: parsedDuration,
        packet_count:
          parsedPacketCount && parsedPacketCount > 0
            ? parsedPacketCount
            : undefined,
      });
      setActiveIds((prev) => [...new Set([...prev, ...selectedIds])]);
      // Delay file refresh so tcpdump writes the pcap header first
      const refreshTimeoutId = window.setTimeout(() => fetchFiles(), 1500);
      refreshTimeoutIdsRef.current.push(refreshTimeoutId);

      if (parsedDuration && parsedDuration > 0) {
        setCaptureEndsAtMs(Date.now() + parsedDuration * 1000);
        setCaptureDurationSeconds(parsedDuration);
        setCountdownSeconds(parsedDuration);

        // If duration is set, auto-clear active state per device when it expires.
        selectedIds.forEach((id) => {
          const existingTimeoutId = autoStopTimeoutByDeviceRef.current.get(id);
          if (existingTimeoutId !== undefined) {
            window.clearTimeout(existingTimeoutId);
          }

          const autoStopTimeoutId = window.setTimeout(
            () => {
              autoStopTimeoutByDeviceRef.current.delete(id);
              setActiveIds((prev) => {
                const next = prev.filter((activeId) => activeId !== id);
                if (next.length === 0) {
                  setCaptureEndsAtMs(null);
                  setCaptureDurationSeconds(null);
                  setCountdownSeconds(null);
                }
                return next;
              });
              fetchFiles();
            },
            parsedDuration * 1000 + 1500,
          );

          autoStopTimeoutByDeviceRef.current.set(id, autoStopTimeoutId);
        });
      } else {
        setCaptureEndsAtMs(null);
        setCaptureDurationSeconds(null);
        setCountdownSeconds(null);
      }

      setPacketCount("");
    } catch {
      // useCapture surfaces start errors; keep local active state unchanged.
    }
  }

  async function handleStop(deviceId: number) {
    try {
      await stopCapture(deviceId);
      const autoStopTimeoutId =
        autoStopTimeoutByDeviceRef.current.get(deviceId);
      if (autoStopTimeoutId !== undefined) {
        window.clearTimeout(autoStopTimeoutId);
        autoStopTimeoutByDeviceRef.current.delete(deviceId);
      }

      setActiveIds((prev) => {
        const next = prev.filter((id) => id !== deviceId);
        if (next.length === 0) {
          setCaptureEndsAtMs(null);
          setCaptureDurationSeconds(null);
          setCountdownSeconds(null);
        }
        return next;
      });
      // Delay so final packets are flushed to the pcap file
      const refreshTimeoutId = window.setTimeout(() => fetchFiles(), 1000);
      refreshTimeoutIdsRef.current.push(refreshTimeoutId);
    } catch {
      // Keep the device active in UI when stop fails; useCapture already stores the error message.
    }
  }

  return (
    <div>
      {activeIds.length > 0 && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 text-center">
            <LoaderCircle
              size={40}
              className="mx-auto mb-4 text-blue-600 animate-spin"
            />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Capturing traffic...
            </h2>
            {hasCountdown && (
              <div className="mb-3 flex justify-center">
                <div className="relative h-16 w-16">
                  <svg
                    className="h-16 w-16 -rotate-90"
                    viewBox="0 0 64 64"
                    aria-hidden="true"
                  >
                    <circle
                      cx="32"
                      cy="32"
                      r={ringRadius}
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="5"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r={ringRadius}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringDashOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-blue-700">
                    {countdownSeconds}s
                  </div>
                </div>
              </div>
            )}
            <p className="text-sm text-gray-600 mb-5">
              {countdownSeconds !== null
                ? `Auto-stop in ${countdownSeconds}s`
                : "Capture running with no timer."}
            </p>

            <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">
                Active Captures
              </p>
              <ul className="space-y-1.5">
                {activeIds.map((id) => (
                  <li key={`status-${id}`} className="text-sm text-blue-900">
                    Capturing{" "}
                    {getDeviceLabel(id)} {" "}
                    (device #{id})
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {activeIds.map((id) => (
                <Button
                  key={id}
                  variant="danger"
                  onClick={() => handleStop(id)}
                >
                  <Square size={14} /> Stop {getDeviceLabel(id)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Packet Capture</h1>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">
          New Capture Session
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Select Devices
            </p>
            <div className="flex flex-wrap gap-2">
              {devices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => toggleDevice(d.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    selectedIds.includes(d.id)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  <span>{d.name ?? d.ip}</span>
                  {activeIds.includes(d.id) && (
                    <Badge
                      variant={selectedIds.includes(d.id) ? "success" : "neutral"}
                      className={
                        selectedIds.includes(d.id)
                          ? "bg-white/20 text-white"
                          : "bg-blue-100 text-blue-700"
                      }
                    >
                      Active
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Duration (seconds)"
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="No limit"
          />
          <Input
            label="Packet Count (optional)"
            type="number"
            value={packetCount}
            onChange={(e) => setPacketCount(e.target.value)}
            placeholder="Unlimited"
          />
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleStart}
            loading={isLoading}
            disabled={!selectedIds.length}
          >
            <Play size={14} /> Start Capture
          </Button>
          {activeIds.map((id) => (
            <Button key={id} variant="danger" onClick={() => handleStop(id)}>
              <Square size={14} /> Stop{" "}
              {devices.find((d) => d.id === id)?.name ?? `#${id}`}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Saved Captures</h2>
          <Button variant="secondary" onClick={fetchFiles}>
            Refresh
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            No capture files yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Filename", "Size", "Created", ""].map((h, idx) => (
                  <th
                    key={h || `header-${idx}`}
                    className="text-left px-4 py-3 font-medium text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {files.map((f) => (
                <tr key={f.filename} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {f.filename}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatBytes(f.size_bytes)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatTimestamp(f.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteFile(f.filename)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
