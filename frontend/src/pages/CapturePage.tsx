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
  const [filenameBase, setFilenameBase] = useState("");
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
    const captureDuration =
      parsedDuration && parsedDuration > 0 ? parsedDuration : undefined;
    const parsedPacketCount = packetCount ? Number(packetCount) : undefined;
    const capturePacketCount =
      parsedPacketCount && parsedPacketCount > 0 ? parsedPacketCount : undefined;

    const trimmedFilename = filenameBase.trim();
    try {
      await startCapture({
        device_ids: selectedIds,
        duration: captureDuration,
        packet_count: capturePacketCount,
        filename: trimmedFilename || undefined,
      });
      setActiveIds((prev) => [...new Set([...prev, ...selectedIds])]);
      // Delay file refresh so tcpdump writes the pcap header first
      const refreshTimeoutId = window.setTimeout(() => fetchFiles(), 1500);
      refreshTimeoutIdsRef.current.push(refreshTimeoutId);

      if (captureDuration) {
        setCaptureEndsAtMs(Date.now() + captureDuration * 1000);
        setCaptureDurationSeconds(captureDuration);
        setCountdownSeconds(captureDuration);

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
            captureDuration * 1000 + 1500,
          );

          autoStopTimeoutByDeviceRef.current.set(id, autoStopTimeoutId);
        });
      } else {
        setCaptureEndsAtMs(null);
        setCaptureDurationSeconds(null);
        setCountdownSeconds(null);
      }

      setPacketCount("");
      setFilenameBase("");
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Packet Capture</h1>

      {activeIds.length > 0 && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/70 p-4">
          <div className="flex items-center gap-3 mb-3">
            <LoaderCircle
              size={20}
              className="text-blue-600 animate-spin"
            />
            <h2 className="font-semibold text-blue-900">
              {hasCountdown
                ? `Capturing traffic — auto-stop in ${countdownSeconds}s`
                : "Capturing traffic — no time limit"}
            </h2>
            {hasCountdown && (
              <div className="relative h-10 w-10 ml-auto">
                <svg
                  className="h-10 w-10 -rotate-90"
                  viewBox="0 0 64 64"
                  aria-hidden="true"
                >
                  <circle cx="32" cy="32" r={ringRadius} fill="none" stroke="#dbeafe" strokeWidth="5" />
                  <circle cx="32" cy="32" r={ringRadius} fill="none" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" strokeDasharray={ringCircumference} strokeDashoffset={ringDashOffset} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-blue-700">
                  {countdownSeconds}s
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {activeIds.map((id) => (
              <Button key={id} variant="danger" onClick={() => handleStop(id)}>
                <Square size={14} /> Stop {getDeviceLabel(id)}
              </Button>
            ))}
          </div>
        </div>
      )}

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
                      variant={
                        selectedIds.includes(d.id) ? "success" : "neutral"
                      }
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
          <div className="md:col-span-3">
            <Input
              label="Pcap Filename (optional)"
              type="text"
              value={filenameBase}
              onChange={(e) => setFilenameBase(e.target.value)}
              placeholder="e.g. kitchen_cam_baseline  (auto-generated if blank)"
            />
            <p className="mt-1 text-xs text-gray-400">
              Letters, digits, <code>._-</code> only. With multiple devices,
              <code> _deviceN</code> is appended to keep files unique.
            </p>
          </div>
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
