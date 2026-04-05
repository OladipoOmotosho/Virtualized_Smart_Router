import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useIps } from "@/hooks/useIps";
import { formatDataRate, formatTimestamp } from "@/lib/utils";

export default function IpsPage() {
  const { status, alerts, isLoading, error } = useIps();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Intrusion Prevention</h1>
        <p className="text-sm text-gray-500 mt-1">Anomaly alerts refresh every 10 seconds</p>
      </div>

      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Monitored Devices", value: status.monitored_devices },
            { label: "Poll Interval", value: `${status.poll_interval_seconds}s` },
            { label: "Block Duration", value: `${status.block_duration_seconds}s` },
            { label: "Total Alerts", value: alerts.length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-2xl font-bold text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700">Anomaly Alerts</h2>
        </div>
        {isLoading && !alerts.length ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-10 text-gray-400">No anomalies detected.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Device ID", "Measured Rate", "Threshold", "Status", "Triggered At"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {alerts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">Device #{a.device_id}</td>
                  <td className="px-4 py-3 font-mono text-xs text-red-600">{formatDataRate(a.measured_rate)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{formatDataRate(a.threshold)}</td>
                  <td className="px-4 py-3"><Badge variant="danger">Anomaly</Badge></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatTimestamp(a.triggered_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
