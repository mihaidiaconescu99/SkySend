import { redirect } from "next/navigation";
import { InternalOrganizationActivation } from "@/components/auth/internal-organization-activation";
import { createPageMetadata } from "@/lib/metadata";
import { resolveRoleRedirectPath } from "@/lib/role-routing";

export const metadata = createPageMetadata(
  "Redirecting",
  "SkySend is redirecting the authenticated user to the correct workspace.",
);

export default async function AuthContinuePage() {
  const { destination, context } = await resolveRoleRedirectPath();

  if (
    context.needsOrganizationActivation &&
    context.internalOrganizationId
  ) {
    return (
      <InternalOrganizationActivation
        organizationId={context.internalOrganizationId}
        destination={destination}
      />
    );
  }
  redirect(destination);
}
