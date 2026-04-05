import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import type { FirewallRule, FirewallRuleCreate } from "@/types";

export function useFirewall() {
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.get<FirewallRule[]>("/firewall/rules");
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rules");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addRule = useCallback(async (rule: FirewallRuleCreate) => {
    try {
      const created = await api.post<FirewallRule>("/firewall/rules", rule);
      setRules((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    }
  }, []);

  const deleteRule = useCallback(async (id: number) => {
    try {
      await api.delete(`/firewall/rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
    }
  }, []);

  const applyRules = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await api.post("/firewall/apply");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply rules");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { rules, isLoading, error, fetchRules, addRule, deleteRule, applyRules };
}
