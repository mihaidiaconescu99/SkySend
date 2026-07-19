"use client";

import { useEffect, useState } from "react";
import type { CreatedDeliveryOrder } from "@/types/create-delivery";

export function useRecipientTrackingOrder(
  identifier: string,
): CreatedDeliveryOrder | null {
  const [order, setOrder] = useState<CreatedDeliveryOrder | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(
      `/api/orders/by-tracking-identifier?identifier=${encodeURIComponent(identifier)}`,
    )
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<CreatedDeliveryOrder>;
      })
      .then((apiOrder) => {
        if (!cancelled) {
          setOrder(apiOrder);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOrder(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [identifier]);

  return order;
}
