import "server-only";

import { getPostAuthRedirectPath } from "@/lib/auth";
import { getServerAuthorizationContext } from "@/lib/server-authorization";

export async function resolveRoleRedirectPath() {
  const context = await getServerAuthorizationContext();
  if (!context.userId) return { destination: "/sign-in", context };
  if (context.resolution === "not_configured") {
    return {
      destination: "/access-denied?reason=authorization-not-configured",
      context,
    };
  }
  if (context.resolution === "unavailable") {
    return {
      destination: "/access-denied?reason=authorization-unavailable",
      context,
    };
  }
  if (!context.role) {
    return {
      destination: "/access-denied?reason=invalid-role",
      context,
    };
  }
  return { destination: getPostAuthRedirectPath(context.role), context };
}
