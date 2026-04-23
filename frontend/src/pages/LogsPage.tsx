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
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatTimestamp } from "@/lib/utils";

const DAY_OPTIONS = [1, 3, 7, 14, 30];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function LogsPage() {
  const {
    traffic,
    systemLogs,
    days,
    setDays,
    isLoading,
    error,
    fetchTraffic,
    fetchSystemLogs,
    purge,
  } = useLogs();

  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchTraffic();
  }, [fetchTraffic, days]);

  useEffect(() => {
    fetchSystemLogs(page);
  }, [fetchSystemLogs, page]);

  const totalPages = systemLogs
    ? Math.max(1, Math.ceil(systemLogs.total / systemLogs.limit))
    : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Traffic history and system activity
          </p>
        </div>
        <Button variant="danger" onClick={() => {
          if (window.confirm("Are you sure you want to purge old logs? This cannot be undone.")) {
            purge();
          }
        }}>
          <Trash2 size={14} /> Purge Old Logs
        </Button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

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
    </div>
  );
}
