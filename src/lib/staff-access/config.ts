import "server-only";

export function getStaffAccessConfig() {
  const enforcementSetting = process.env.STAFF_ACCESS_ENFORCEMENT?.trim();
  const cloudflareSetting = process.env.CLOUDFLARE_ACCESS_ENFORCED?.trim();

  return {
    clerkOrganizationId: process.env.CLERK_INTERNAL_ORGANIZATION_ID?.trim() ?? "",
    // The database is the source of truth unless the external access controls
    // have been deliberately enabled through the deployment environment.
    enforcement: enforcementSetting === "strict" ? "strict" : "database",
    cloudflareAccountId: process.env.CLOUDFLARE_ACCESS_ACCOUNT_ID?.trim() ?? "",
    cloudflareGroupId: process.env.CLOUDFLARE_ACCESS_GROUP_ID?.trim() ?? "",
    cloudflareApiToken: process.env.CLOUDFLARE_ACCESS_API_TOKEN?.trim() ?? "",
    cloudflareTeamDomain: process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.trim().replace(/\/$/u, "") ?? "",
    cloudflareAudience: process.env.CLOUDFLARE_ACCESS_AUD?.trim() ?? "",
    cloudflareEnforced: cloudflareSetting === "true",
    totpEncryptionKey: process.env.ACCESS_TOTP_ENCRYPTION_KEY?.trim() ?? "",
    recoveryCodePepper: process.env.ACCESS_RECOVERY_CODE_PEPPER?.trim() ?? "",
  } as const;
}

export function hasStrictExternalAccessConfig() {
  const config = getStaffAccessConfig();
  return Boolean(
    config.clerkOrganizationId &&
      config.cloudflareAccountId &&
      config.cloudflareGroupId &&
      config.cloudflareApiToken,
  );
}
