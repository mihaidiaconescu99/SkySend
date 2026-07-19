import { redirect } from "next/navigation";
import { createPageMetadata } from "@/lib/metadata";
import { resolveRoleRedirectPath } from "@/lib/role-routing";

export const metadata = createPageMetadata(
  "Redirecting",
  "SkySend is redirecting the authenticated user to the correct workspace.",
);

export default async function AuthContinuePage() {
  const destination = await resolveRoleRedirectPath();

  redirect(destination);
}
