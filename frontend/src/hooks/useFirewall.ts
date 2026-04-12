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
      setError(null);
      const created = await api.post<FirewallRule>("/firewall/rules", rule);
      setRules((prev) => [...prev, created]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
      return false;
    }
  }, []);

  const deleteRule = useCallback(async (id: number) => {
    try {
      await api.delete(`/firewall/rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
      return false;
    }
  }, []);

  const applyRules = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await api.post("/firewall/apply");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply rules");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    rules,
    isLoading,
    error,
    fetchRules,
    addRule,
    deleteRule,
    applyRules,
  };
}
