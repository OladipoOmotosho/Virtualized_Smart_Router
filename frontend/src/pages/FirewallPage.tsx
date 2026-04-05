import { useEffect, useState } from "react";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { useFirewall } from "@/hooks/useFirewall";
import { useDevices } from "@/hooks/useDevices";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import type { FirewallRuleCreate, Protocol } from "@/types";

const PROTOCOLS: Protocol[] = ["tcp", "udp", "icmp"];

export default function FirewallPage() {
  const {
    rules,
    isLoading: rulesLoading,
    error,
    fetchRules,
    addRule,
    deleteRule,
    applyRules,
  } = useFirewall();
  const { devices, fetchDevices } = useDevices();
  const [showForm, setShowForm] = useState(false);
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
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Add Rule
          </Button>
          <Button onClick={applyRules} loading={rulesLoading}>
            <ShieldCheck size={14} /> Apply Rules
          </Button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

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
                    <button
                      onClick={() => deleteRule(r.id)}
                      className="text-red-400 hover:text-red-600"
                      aria-label="Delete rule"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  );
}
