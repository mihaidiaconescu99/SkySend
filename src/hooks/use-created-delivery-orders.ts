"use client";

import { useCallback, useEffect, useState } from "react";

import { useCurrentProfile } from "@/lib/profile-context/profile-context";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";

export type CreatedDeliveryOrderWithSource = CreatedDeliveryOrder & {
  _source: "supabase" | "local";
};

export function useCreatedDeliveryOrders(): {
  orders: CreatedDeliveryOrderWithSource[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { state } = useCurrentProfile();

  const profileId =
    state.status === "authenticated" ? state.profile.id : null;

  const [orders, setOrders] = useState<CreatedDeliveryOrderWithSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (!profileId) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/client/orders", {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });

      if (!response.ok) {
        const body: { error?: string } | null = await response
          .json()
          .catch(() => null);
        const message =
          body?.error ?? `Failed to load orders (HTTP ${response.status}).`;
        setError(message);
        setOrders([]);
        return;
      }

      const body = (await response.json()) as {
        created?: CreatedDeliveryOrder[];
      };
      const created = Array.isArray(body.created) ? body.created : [];

      setOrders(
        created.map((order) => ({ ...order, _source: "supabase" as const })),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.warn("[useCreatedDeliveryOrders] unexpected error:", err);
      setError(message);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {

    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  return { orders, isLoading, error, refresh };
}
