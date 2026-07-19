import { isUserRole } from "@/lib/auth";
import { createPageMetadata } from "@/lib/metadata";
import { AccessDeniedState } from "@/components/auth/access-denied-state";

export const metadata = createPageMetadata(
  "Access Denied",
  "Protected workspace access is not available for the current SkySend role.",
);

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const required = Array.isArray(params.required) ? params.required[0] : params.required;
  const current = Array.isArray(params.current) ? params.current[0] : params.current;
  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason;

  return (
    <AccessDeniedState
      requiredRole={isUserRole(required) ? required : null}
      currentRole={isUserRole(current) ? current : null}
      reason={reason === "invalid-role" || reason === "no-role" ? reason : null}
    />
  );
}
