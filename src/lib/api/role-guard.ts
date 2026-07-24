import "server-only";

import { NextResponse } from "next/server";
import { authorizeServerRoles } from "@/lib/server-authorization";
import type { UserRole } from "@/types/roles";

export async function authorizeApiRequest(
  allowedRoles: readonly UserRole[],
) {
  const decision = await authorizeServerRoles(allowedRoles);
  if (decision.ok) return decision;

  return {
    ok: false as const,
    response: NextResponse.json(
      { error: decision.error },
      { status: decision.status },
    ),
  };
}
