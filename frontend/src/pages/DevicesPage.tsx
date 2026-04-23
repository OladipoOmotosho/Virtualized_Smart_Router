import { useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { useDevices } from "@/hooks/useDevices";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import type { Device, DeviceUpdate } from "@/types";
import { formatTimestamp } from "@/lib/utils";

export default function DevicesPage() {
  const {
    devices,
    isLoading,
    fetchDevices,
    scanDevices,
    updateDevice,
    deleteDevice,
    deleteAllDevices,
  } = useDevices();
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState<DeviceUpdate>({});
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteDevice, setConfirmDeleteDevice] = useState<Device | null>(
    null,
  );
  const [confirmClearAll, setConfirmClearAll] = useState(false);

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

  async function handleConfirmDelete() {
    if (!confirmDeleteDevice) return;
    setDeletingId(confirmDeleteDevice.id);
    const ok = await deleteDevice(confirmDeleteDevice.id);
    setDeletingId(null);
    if (ok) {
      setConfirmDeleteDevice(null);
    }
  }

  async function handleConfirmClearAll() {
    const ok = await deleteAllDevices();
    if (ok) {
      setConfirmClearAll(false);
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
        <div className="flex gap-2">
          {devices.length > 0 && (
            <Button
              variant="danger"
              onClick={() => setConfirmClearAll(true)}
              disabled={isLoading}
            >
              <Trash2 size={14} />
              Clear All
            </Button>
          )}
          <Button onClick={scanDevices} loading={isLoading} variant="primary">
            <RefreshCw size={14} />
            Scan Network
          </Button>
        </div>
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
                {["Name", "IPv4", "IPv6", "MAC", "Vendor", "Last Seen", ""].map((h, idx) => (
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
                    {d.ip || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {d.ipv6 ?? <span className="text-gray-300">—</span>}
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
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => openEdit(d)}>
                        Edit
                      </Button>
                      <button
                        onClick={() => setConfirmDeleteDevice(d)}
                        disabled={deletingId === d.id}
                        aria-label={`Delete ${d.name ?? d.ip}`}
                        className="text-red-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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

      <Modal
        open={!!confirmDeleteDevice}
        onClose={() => setConfirmDeleteDevice(null)}
        title="Delete Device"
      >
        <p className="text-sm text-gray-600 mb-2">
          Remove{" "}
          <strong>
            {confirmDeleteDevice?.name ?? confirmDeleteDevice?.ip}
          </strong>{" "}
          from the device list?
        </p>
        <p className="text-xs text-gray-500 mb-4">
          Related firewall rules, captures, traffic history, and IPS alerts
          for this device will also be removed. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setConfirmDeleteDevice(null)}
            disabled={deletingId !== null}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmDelete}
            loading={deletingId !== null}
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmClearAll}
        onClose={() => setConfirmClearAll(false)}
        title="Clear All Devices"
      >
        <p className="text-sm text-gray-600 mb-2">
          This will remove <strong>every</strong> device in the list.
        </p>
        <p className="text-xs text-red-500 mb-4">
          Warning: all firewall rules, captures, traffic history, and IPS
          alerts will also be wiped. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setConfirmClearAll(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmClearAll}
            loading={isLoading}
          >
            <Trash2 size={14} /> Clear All
          </Button>
        </div>
      </Modal>
    </div>
  );
}
