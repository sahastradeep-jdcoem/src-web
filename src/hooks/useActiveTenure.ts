"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  CouncilTenure, 
  getStoredTenures, 
  subscribeToTenures, 
  syncTenuresFromFirestore,
  switchActiveTenure as storeSwitchActiveTenure,
  undoActiveTenure as storeUndoActiveTenure
} from "@/lib/tenureStore";
import { getActiveTenure } from "@/lib/tenureEngine";

/**
 * React Hook for consuming and orchestrating the active tenure universally on the client.
 */
export function useActiveTenure() {
  const [tenures, setTenures] = useState<CouncilTenure[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return getStoredTenures();
      } catch {}
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(true);

  const activeTenure = useMemo(() => {
    return getActiveTenure(tenures);
  }, [tenures]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initial = getStoredTenures();
    if (initial && initial.length > 0) {
      setTenures(initial);
      setIsLoading(false);
    }

    // Sync from Firestore
    syncTenuresFromFirestore()
      .then((remote) => {
        if (remote && Array.isArray(remote) && remote.length > 0) {
          setTenures(remote);
        }
      })
      .finally(() => setIsLoading(false));

    // Real-time listener
    const unsubscribe = subscribeToTenures((updated) => {
      if (Array.isArray(updated) && updated.length > 0) {
        setTenures(updated);
        setIsLoading(false);
      }
    });

    const handleCustomChange = (e: any) => {
      const list = getStoredTenures();
      setTenures(list);
    };

    window.addEventListener("src_tenure_changed", handleCustomChange);
    window.addEventListener("src_tenures_updated", handleCustomChange);

    return () => {
      unsubscribe();
      window.removeEventListener("src_tenure_changed", handleCustomChange);
      window.removeEventListener("src_tenures_updated", handleCustomChange);
    };
  }, []);

  const switchTenure = useCallback(async (targetTenureId: string, beginDate?: string) => {
    await storeSwitchActiveTenure(targetTenureId, beginDate);
    const updated = getStoredTenures();
    setTenures(updated);
  }, []);

  const undoTenure = useCallback(async (tenureId: string) => {
    const result = await storeUndoActiveTenure(tenureId);
    const updated = getStoredTenures();
    setTenures(updated);
    return result;
  }, []);

  return {
    activeTenure,
    tenures,
    isLoading,
    switchTenure,
    undoTenure,
  };
}
