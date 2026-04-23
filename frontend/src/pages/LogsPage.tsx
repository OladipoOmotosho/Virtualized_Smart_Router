import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { useLogs } from "@/hooks/useLogs";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { formatTimestamp } from "@/lib/utils";

type PurgeScope = "traffic" | "alerts" | "both";
type PurgeCutoff = "7" | "30" | "90" | "all";

const SCOPE_LABEL: Record<PurgeScope, string> = {
  traffic: "Traffic history only",
  alerts: "IPS alerts only",
  both: "Both traffic history and IPS alerts",
};

const CUTOFF_OPTIONS: { value: PurgeCutoff; label: string }[] = [
  { value: "7", label: "Older than 7 days" },
  { value: "30", label: "Older than 30 days" },
  { value: "90", label: "Older than 90 days" },
  { value: "all", label: "All records (no cutoff)" },
];

const DAY_OPTIONS = [1, 3, 7, 14, 30];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function LogsPage() {
  const {
    traffic,
    systemLogs,
    days,
    setDays,
    isLoading,
    fetchTraffic,
    fetchSystemLogs,
    purge,
  } = useLogs();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeScope, setPurgeScope] = useState<PurgeScope>("both");
  const [purgeCutoff, setPurgeCutoff] = useState<PurgeCutoff>("30");

  useEffect(() => {
    fetchTraffic();
  }, [fetchTraffic, days]);

  useEffect(() => {
    fetchSystemLogs(page);
  }, [fetchSystemLogs, page]);

  const totalPages = systemLogs
    ? Math.max(1, Math.ceil(systemLogs.total / systemLogs.limit))
    : 1;

  const handleConfirmPurge = async () => {
    const olderThanDays = purgeCutoff === "all" ? null : Number(purgeCutoff);
    try {
      const result = await purge({ scope: purgeScope, olderThanDays });
      toast.success(result?.message ?? "Purge complete");
      setPurgeModalOpen(false);
      setPage(1);
      fetchTraffic();
      fetchSystemLogs(1);
    } catch {
      // toast already shown by the hook
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Traffic history and system activity
          </p>
        </div>
        <Button
          variant="danger"
          onClick={() => setPurgeModalOpen(true)}
        >
          <Trash2 size={14} /> Purge Old Logs
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">Traffic Rate History</h2>
          <div className="flex gap-2">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDays(d);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${d === days ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : traffic.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            No traffic data for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart margin={{ top: 10, right: 24, left: 8, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="epoch"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickCount={8}
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickFormatter={(v: number) => new Date(v).toLocaleTimeString()}
                padding={{ left: 12, right: 12 }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
                label={{ value: "KB/s", angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "#6b7280" } }}
              />
              <Tooltip
                labelFormatter={(v: number) => new Date(v).toLocaleString()}
                formatter={(v: number) => [`${Number(v).toFixed(1)} KB/s`, ""]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {traffic.map((t, i) => {
                const sortedData = t.data
                  .map((d) => ({
                    ...d,
                    epoch: new Date(
                      d.recorded_at.endsWith("Z") || d.recorded_at.includes("+")
                        ? d.recorded_at
                        : d.recorded_at + "Z",
                    ).getTime(),
                  }))
                  .sort((a, b) => a.epoch - b.epoch);
                return (
                  <Line
                    key={t.device_id}
                    data={sortedData}
                    dataKey="rate_kbps"
                    name={`Device #${t.device_id}`}
                    stroke={COLORS[i % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    type="monotone"
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {systemLogs && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-700">
              System Log ({systemLogs.total} entries)
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Device", "Rate", "Threshold", "Triggered At"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-medium text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {systemLogs.items.map((item, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    Device #{String(item["device_id"])}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-red-500">
                    {Number(item["measured_rate"]).toFixed(1)} KB/s
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {Number(item["threshold"]).toFixed(1)} KB/s
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatTimestamp(String(item["triggered_at"]))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {systemLogs.total > 0 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        open={purgeModalOpen}
        onClose={() => setPurgeModalOpen(false)}
        title="Purge Logs"
      >
        <p className="text-sm text-gray-600 mb-4">
          Select what to delete. This cannot be undone.
        </p>

        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Scope
          </p>
          <div className="space-y-2">
            {(Object.keys(SCOPE_LABEL) as PurgeScope[]).map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
              >
                <input
                  type="radio"
                  name="purge-scope"
                  value={s}
                  checked={purgeScope === s}
                  onChange={() => setPurgeScope(s)}
                  className="accent-blue-600"
                />
                {SCOPE_LABEL[s]}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Timeline
          </p>
          <select
            value={purgeCutoff}
            onChange={(e) => setPurgeCutoff(e.target.value as PurgeCutoff)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CUTOFF_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {purgeCutoff === "all" && (
            <p className="text-xs text-red-500 mt-2">
              Warning: this deletes every row in the selected scope.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setPurgeModalOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmPurge}
            disabled={isLoading}
          >
            <Trash2 size={14} /> Purge
          </Button>
        </div>
      </Modal>
    </div>
  );
}
