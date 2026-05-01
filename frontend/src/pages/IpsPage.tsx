import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useIps } from "@/hooks/useIps";
import { formatDataRate, formatTimestamp } from "@/lib/utils";

export default function IpsPage() {
  const { status, alerts, isLoading, updateSettings } = useIps();
  const initializedRef = useRef(false);
  const [minThreshold, setMinThreshold] = useState("");
  const [maxThreshold, setMaxThreshold] = useState("");

  useEffect(() => {
    if (status && !initializedRef.current) {
      setMinThreshold(String(status.min_threshold_kbps));
      setMaxThreshold(String(status.max_threshold_kbps));
      initializedRef.current = true;
    }
  }, [status]);

  async function handleSaveThresholds() {
    const min = Number(minThreshold);
    const max = Number(maxThreshold);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
      return;
    }

    if (min > max) {
      return;
    }

    const updated = await updateSettings({
      min_threshold_kbps: min,
      max_threshold_kbps: max,
    });

    if (updated) {
      setMinThreshold(String(updated.min_threshold_kbps));
      setMaxThreshold(String(updated.max_threshold_kbps));
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Intrusion Prevention
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Anomaly alerts refresh every 10 seconds
        </p>
      </div>

      {status && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Monitored Devices", value: status.monitored_devices },
            {
              label: "Poll Interval",
              value: `${status.poll_interval_seconds}s`,
            },
            {
              label: "Block Duration",
              value: `${status.block_duration_seconds}s`,
            },
            {
              label: "Alert Recipient",
              value: status.alert_recipient || "Not set",
            },
            { label: "Total Alerts", value: alerts.length },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-sm font-semibold text-gray-800 break-words">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {status && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-700">IPS Thresholds</h2>
              <p className="text-xs text-gray-400 mt-1">
                Thresholds are measured in KB/s. 10 MB/s is about 10240 KB/s.
              </p>
            </div>
            <Badge variant="neutral">
              <CheckCircle2 size={12} className="mr-1" />
              Active
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Input
              label="Minimum threshold (KB/s)"
              type="number"
              min="0"
              step="0.1"
              value={minThreshold}
              onChange={(e) => setMinThreshold(e.target.value)}
            />
            <Input
              label="Maximum threshold (KB/s)"
              type="number"
              min="0"
              step="0.1"
              value={maxThreshold}
              onChange={(e) => setMaxThreshold(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSaveThresholds}
              disabled={
                !minThreshold ||
                !maxThreshold ||
                Number(minThreshold) > Number(maxThreshold)
              }
            >
              Save Thresholds
            </Button>
            <p className="text-xs text-gray-500">
              Low traffic alerts when traffic falls below the minimum. High
              traffic alerts also send mail, start a forensic capture, and
              temporarily block the device.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700">Anomaly Alerts</h2>
        </div>
        {isLoading && !alerts.length ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            No anomalies detected.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {[
                  "Device ID",
                  "Measured Rate",
                  "Threshold",
                  "Status",
                  "Triggered At",
                ].map((h) => (
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
              {alerts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    Device #{a.device_id}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-red-600">
                    {formatDataRate(a.measured_rate)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {formatDataRate(a.threshold)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={a.anomaly_type === "low" ? "warning" : "danger"}
                    >
                      {a.anomaly_type === "low"
                        ? "Below minimum"
                        : "Above maximum"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatTimestamp(a.triggered_at)}
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
