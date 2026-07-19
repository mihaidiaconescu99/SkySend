"use client";

import { usePathname } from "next/navigation";
import type { DashboardRole } from "@/types/roles";
import { isDashboardRole } from "@/lib/auth";

export function useActiveeRole(): DashboardRole | null {
  const pathname = usePathname();
  const activeSegment = pathname.split("/").filter(Boolean)[0];

  return isDashboardRole(activeSegment) ? activeSegment : null;
}
