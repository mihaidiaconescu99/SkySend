"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CreateDeliveryAddressField } from "@/lib/create-delivery-addresses";
import type { MapViewport } from "@/types/map";

type ResolveFromMapCenter = (
  field: CreateDeliveryAddressField,
  viewport: MapViewport,
  signal: AbortSignal,
) => Promise<boolean>;

export function useMapCenterSelectionController({
  onResolve,
}: {
  onResolve: ResolveFromMapCenter;
}) {
  const [activeField, setActiveField] =
    useState<CreateDeliveryAddressField | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(
    null,
  );

  const cancelPendingRequest = useCallback(() => {
    requestRef.current?.controller.abort();
    requestRef.current = null;
    setIsResolving(false);
  }, []);

  const toggleField = useCallback(
    (field: CreateDeliveryAddressField) => {
      cancelPendingRequest();
      setActiveField((current) => {
        const nextField = current === field ? null : field;
        setFeedback(
          nextField
            ? `Mută harta pentru adresa de ${nextField === "pickup" ? "ridicare" : "livrare"}.`
            : null,
        );
        return nextField;
      });
    },
    [cancelPendingRequest],
  );

  const stopSelection = useCallback(() => {
    cancelPendingRequest();
    setActiveField(null);
    setFeedback(null);
  }, [cancelPendingRequest]);

  const handleViewportSettled = useCallback(
    async (viewport: MapViewport) => {
      if (!activeField) {
        return;
      }

      requestRef.current?.controller.abort();
      const controller = new AbortController();
      const requestId = (requestRef.current?.id ?? 0) + 1;
      requestRef.current = { id: requestId, controller };
      setIsResolving(true);
      setFeedback("Actualizăm adresa din centrul hărții…");

      try {
        const didResolve = await onResolve(
          activeField,
          viewport,
          controller.signal,
        );

        if (
          controller.signal.aborted ||
          requestRef.current?.id !== requestId
        ) {
          return;
        }

        setFeedback(
          didResolve
            ? `Adresa de ${activeField === "pickup" ? "ridicare" : "livrare"} a fost actualizată.`
            : "Nu am putut identifica o adresă sigură în acel punct.",
        );
      } catch {
        if (
          controller.signal.aborted ||
          requestRef.current?.id !== requestId
        ) {
          return;
        }

        setFeedback("Adresa nu a putut fi actualizată. Încearcă o poziție apropiată.");
      } finally {
        if (requestRef.current?.id === requestId) {
          requestRef.current = null;
          setIsResolving(false);
        }
      }
    },
    [activeField, onResolve],
  );

  useEffect(
    () => () => {
      requestRef.current?.controller.abort();
      requestRef.current = null;
    },
    [],
  );

  return {
    activeField,
    feedback,
    isResolving,
    toggleField,
    stopSelection,
    handleViewportSettled,
  };
}
