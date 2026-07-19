import "server-only";

import { auth } from "@clerk/nextjs/server";
import { getPostAuthRedirectPath } from "@/lib/auth";
import { getCurrentStaffAccess } from "@/lib/staff-access/server";

export async function resolveRoleRedirectPath() {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
  const access = await getCurrentStaffAccess();
  return getPostAuthRedirectPath(access?.role ?? "client");
}
