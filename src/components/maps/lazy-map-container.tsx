"use client";

import dynamic from "next/dynamic";
import type { MapContainerProps } from "@/types/map";

function LazyMapFallback() {
  return (
    <div className="map-surface relative min-h-[24rem] overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[var(--elevation-soft)]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--border)_44%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_srgb,var(--border)_44%,transparent)_1px,transparent_1px)] bg-[size:2rem_2rem]" />
      <div className="absolute left-4 top-4 rounded-[calc(var(--radius)+0.25rem)] border border-border/80 bg-card/90 px-3 py-2 text-xs text-muted-foreground shadow-[var(--elevation-soft)]">
        Se incarca harta...
      </div>
    </div>
  );
}

export const LazyMapContainer = dynamic<MapContainerProps>(
  () => import("@/components/maps/map-container").then((module) => module.MapContainer),
  {
    ssr: false,
    loading: () => <LazyMapFallback />,
  },
);

