import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { useFirewall } from "@/hooks/useFirewall";
import { useDevices } from "@/hooks/useDevices";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { formatBytes } from "@/lib/utils";
import type {
  FirewallRule,
  FirewallRuleCreate,
  FirewallRuleUpdate,
  Protocol,
} from "@/types";

const PROTOCOLS: Protocol[] = ["tcp", "udp", "icmp"];

export default function FirewallPage() {
  const {
    rules,
    isLoading: rulesLoading,
    fetchRules,
    addRule,
    updateRule,
    deleteRule,
    applyRules,
    counters,
    countersLoading,
    fetchCounters,
  } = useFirewall();
  const { devices, fetchDevices } = useDevices();
  const [showForm, setShowForm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null);
  const [editForm, setEditForm] = useState<FirewallRuleCreate>({
    device_id: 0,
    dest_ip: "",
    protocol: "tcp",
  });
  const [form, setForm] = useState<FirewallRuleCreate>({
    device_id: 0,
    dest_ip: "",
    protocol: "tcp",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchRules();
    fetchDevices();
  }, [fetchRules, fetchDevices]);

  useEffect(() => {
    fetchCounters();
    const timer = setInterval(fetchCounters, 5000);
    return () => clearInterval(timer);
  }, [fetchCounters]);

  async function handleAdd() {
    if (!form.dest_ip || !form.device_id) return;
    setIsLoading(true);
    try {
      const created = await addRule(form);
      if (!created) return;
      setShowForm(false);
      setForm({ device_id: 0, dest_ip: "", protocol: "tcp" });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (confirmDeleteId === null) return;
    setPendingDeleteId(confirmDeleteId);
    try {
      const deleted = await deleteRule(confirmDeleteId);
      if (deleted) {
        await applyRules();
      }
    } finally {
      setPendingDeleteId(null);
      setConfirmDeleteId(null);
    }
  }

  function openEdit(rule: FirewallRule) {
    setEditingRule(rule);
    setEditForm({
      device_id: rule.device_id,
      dest_ip: rule.dest_ip,
      dest_port: rule.dest_port ?? undefined,
      protocol: rule.protocol,
    });
  }

  async function handleSaveEdit() {
    if (!editingRule) return;
    if (!editForm.dest_ip || !editForm.device_id) return;

    setIsLoading(true);
    try {
      const patch: FirewallRuleUpdate = {
        device_id: editForm.device_id,
        dest_ip: editForm.dest_ip,
        protocol: editForm.protocol,
      };
      // dest_port: explicit clear vs new value
      if (editForm.dest_port === undefined || editForm.dest_port === null) {
        patch.clear_port = true;
      } else {
        patch.dest_port = editForm.dest_port;
      }
      const ok = await updateRule(editingRule.id, patch);
      if (!ok) return;
      await applyRules();
      setEditingRule(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClearAll() {
    if (!rules.length) return;
    setIsLoading(true);
    try {
      await Promise.all(rules.map((rule) => deleteRule(rule.id)));
      await applyRules();
      setConfirmClearAll(false);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Firewall</h1>
          <p className="text-sm text-gray-500 mt-1">
            Whitelist-based traffic rules applied via iptables
          </p>
        </div>
        <div className="flex gap-3">
          {rules.length > 0 && (
            <Button
              variant="danger"
              onClick={() => setConfirmClearAll(true)}
              disabled={isLoading || rulesLoading}
            >
              Clear All
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Add Rule
          </Button>
          <Button onClick={applyRules} loading={rulesLoading}>
            <ShieldCheck size={14} /> Apply Rules
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">Live Counters</h2>
          <span className="text-xs text-gray-400">updates every 5s</span>
        </div>
        {countersLoading && !counters.length ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : counters.length === 0 ? (
          <div className="text-sm text-gray-400">
            No counters yet. Apply rules to start tracking device traffic.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {"Device, RX, TX, Packets".split(", ").map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2 font-medium text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {counters.map((c) => (
                  <tr key={c.device_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-700">
                      {(() => {
                        const device = devices.find(
                          (d) => d.id === c.device_id,
                        );
                        return (
                          device?.name ||
                          device?.ip ||
                          c.ip ||
                          `Device #${c.device_id}`
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">
                      {formatBytes(c.rx_bytes)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">
                      {formatBytes(c.tx_bytes)}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      RX {c.rx_packets.toLocaleString()} / TX{" "}
                      {c.tx_packets.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rulesLoading && !rules.length ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          No whitelist rules configured.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Device", "Dest IP", "Port", "Protocol", ""].map((h, idx) => (
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
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">
                    {devices.find((d) => d.id === r.device_id)?.name ??
                      `Device #${r.device_id}`}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {r.dest_ip}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {r.dest_port ?? "any"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="neutral">{r.protocol.toUpperCase()}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => openEdit(r)}
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        aria-label="Edit rule"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(r.id)}
                        disabled={pendingDeleteId === r.id}
                        className="text-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Delete rule"
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
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete Rule"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this firewall rule? Changes apply
            immediately after deletion.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={pendingDeleteId !== null}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmClearAll}
        onClose={() => setConfirmClearAll(false)}
        title="Clear All Rules"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will delete every firewall rule and apply the change
            immediately.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setConfirmClearAll(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleClearAll}
              loading={isLoading}
            >
              Clear All
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add Whitelist Rule"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Device
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.device_id}
              onChange={(e) =>
                setForm({ ...form, device_id: Number(e.target.value) })
              }
            >
              <option value={0}>Select device…</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ?? d.ip}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Destination IP"
            value={form.dest_ip}
            onChange={(e) => setForm({ ...form, dest_ip: e.target.value })}
            placeholder="8.8.8.8"
          />
          <Input
            label="Destination Port (optional)"
            type="number"
            value={form.dest_port ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                dest_port: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="443"
          />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Protocol
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.protocol}
              onChange={(e) =>
                setForm({ ...form, protocol: e.target.value as Protocol })
              }
            >
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              loading={isLoading}
              disabled={!form.dest_ip || !form.device_id}
            >
              Add Rule
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={editingRule !== null}
        onClose={() => setEditingRule(null)}
        title="Edit Whitelist Rule"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Device
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={editForm.device_id}
              onChange={(e) =>
                setEditForm({ ...editForm, device_id: Number(e.target.value) })
              }
            >
              <option value={0}>Select device…</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ?? d.ip}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Destination IP"
            value={editForm.dest_ip}
            onChange={(e) =>
              setEditForm({ ...editForm, dest_ip: e.target.value })
            }
            placeholder="8.8.8.8"
          />
          <Input
            label="Destination Port (leave blank for any-port)"
            type="number"
            value={editForm.dest_port ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                dest_port: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="443"
          />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Protocol
            </label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={editForm.protocol}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  protocol: e.target.value as Protocol,
                })
              }
            >
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {p.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            Saving will re-apply the firewall to iptables immediately.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditingRule(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              loading={isLoading}
              disabled={!editForm.dest_ip || !editForm.device_id}
            >
              Save & Apply
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
