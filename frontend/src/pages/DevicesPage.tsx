import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useDevices } from "@/hooks/useDevices";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import type { Device, DeviceUpdate } from "@/types";
import { formatTimestamp } from "@/lib/utils";

export default function DevicesPage() {
  const { devices, isLoading, fetchDevices, scanDevices, updateDevice } =
    useDevices();
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState<DeviceUpdate>({});

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  function openEdit(device: Device) {
    setEditing(device);
    setForm({
      name: device.name ?? "",
      model: device.model ?? "",
      version: device.version ?? "",
      description: device.description ?? "",
    });
  }

  async function handleSave() {
    if (!editing) return;
    const updated = await updateDevice(editing.id, form);
    if (updated) {
      setEditing(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Discovered IoT devices on the gateway network
          </p>
        </div>
        <Button onClick={scanDevices} loading={isLoading} variant="primary">
          <RefreshCw size={14} />
          Scan Network
        </Button>
      </div>

      {isLoading && !devices.length ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          No devices found. Run a network scan.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Name", "IP", "MAC", "Vendor", "Last Seen", ""].map((h, idx) => (
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
              {devices.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {d.name ?? <span className="text-gray-400">Unnamed</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {d.ip}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {d.mac}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="neutral">{d.vendor ?? "Unknown"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatTimestamp(d.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" onClick={() => openEdit(d)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Device"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={form.name ?? ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Model"
            value={form.model ?? ""}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
          <Input
            label="Version"
            value={form.version ?? ""}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
          />
          <Input
            label="Description"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
