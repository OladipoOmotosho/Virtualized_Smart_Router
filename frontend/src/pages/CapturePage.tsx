import { useEffect, useState } from "react";
import { Play, Square, Trash2 } from "lucide-react";
import { useCapture } from "@/hooks/useCapture";
import { useDevices } from "@/hooks/useDevices";
import { Button } from "@/components/ui/Button";
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
  const [duration, setDuration] = useState("");

  useEffect(() => {
    fetchDevices();
    fetchFiles();
  }, [fetchDevices, fetchFiles]);

  function toggleDevice(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleStart() {
    if (!selectedIds.length) return;
    await startCapture({
      device_ids: selectedIds,
      duration: duration ? Number(duration) : undefined,
    });
    await fetchFiles();
  }

  return (
    <div>
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
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    selectedIds.includes(d.id)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {d.name ?? d.ip}
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
        </div>
        <div className="flex gap-3">
          <Button
            onClick={handleStart}
            loading={isLoading}
            disabled={!selectedIds.length}
          >
            <Play size={14} /> Start Capture
          </Button>
          {selectedIds.map((id) => (
            <Button key={id} variant="danger" onClick={() => stopCapture(id)}>
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
