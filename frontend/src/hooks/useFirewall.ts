import { useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/contexts/ToastContext";
import type { FirewallRule, FirewallRuleCreate } from "@/types";

export function useFirewall() {
  const toast = useToast();
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<FirewallRule[]>("/firewall/rules");
      setRules(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load rules");
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const addRule = useCallback(
    async (rule: FirewallRuleCreate) => {
      try {
        const created = await api.post<FirewallRule>("/firewall/rules", rule);
        setRules((prev) => [...prev, created]);
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add rule");
        return false;
      }
    },
    [toast],
  );

  const deleteRule = useCallback(
    async (id: number) => {
      try {
        await api.delete(`/firewall/rules/${id}`);
        setRules((prev) => prev.filter((r) => r.id !== id));
        return true;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete rule",
        );
        return false;
      }
    },
    [toast],
  );

  const applyRules = useCallback(async () => {
    try {
      setIsLoading(true);
      await api.post("/firewall/apply");
      toast.success("Firewall rules applied");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply rules");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    rules,
    isLoading,
    fetchRules,
    addRule,
    deleteRule,
    applyRules,
  };
}
