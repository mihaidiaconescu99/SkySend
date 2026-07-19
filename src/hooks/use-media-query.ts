"use client";

import { useSyncExternalStore } from "react";

function getServerSnapshot(): boolean {
  return false;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mediaQueryList = window.matchMedia(query);
      const handler = () => onStoreChange();

      if (mediaQueryList.addEventListener) {
        mediaQueryList.addEventListener("change", handler);
        return () => mediaQueryList.removeEventListener("change", handler);
      }

      mediaQueryList.addListener(handler);
      return () => mediaQueryList.removeListener(handler);
    },
    () => window.matchMedia(query).matches,
    getServerSnapshot,
  );
}
