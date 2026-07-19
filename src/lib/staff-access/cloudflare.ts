import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { getStaffAccessConfig } from "@/lib/staff-access/config";

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksUrl = "";

function getCloudflareJwks(teamDomain: string) {
  const url = `${teamDomain}/cdn-cgi/access/certs`;
  if (!cachedJwks || cachedJwksUrl !== url) {
    cachedJwks = createRemoteJWKSet(new URL(url));
    cachedJwksUrl = url;
  }
  return cachedJwks;
}

export async function verifyCloudflareAccessToken(
  token: string | null,
): Promise<{ ok: true; payload: JWTPayload | null } | { ok: false; error: string }> {
  const config = getStaffAccessConfig();
  if (!config.cloudflareEnforced) return { ok: true, payload: null };
  if (!config.cloudflareTeamDomain || !config.cloudflareAudience) {
    return { ok: false, error: "Cloudflare Access is not fully configured." };
  }
  if (!token) return { ok: false, error: "Cloudflare Access token missing." };

  try {
    const { payload } = await jwtVerify(token, getCloudflareJwks(config.cloudflareTeamDomain), {
      issuer: config.cloudflareTeamDomain,
      audience: config.cloudflareAudience,
    });
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "Cloudflare Access token invalid." };
  }
}

type CloudflareGroup = {
  name: string;
  include?: Array<Record<string, unknown>>;
  exclude?: Array<Record<string, unknown>>;
  require?: Array<Record<string, unknown>>;
  is_default?: boolean;
};

export async function syncCloudflareStaffEmail(email: string, shouldInclude: boolean) {
  const config = getStaffAccessConfig();
  const configured = Boolean(
    config.cloudflareAccountId && config.cloudflareGroupId && config.cloudflareApiToken,
  );
  if (!configured) {
    if (config.enforcement === "strict") throw new Error("Cloudflare Access group is not configured.");
    return { skipped: true } as const;
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.cloudflareAccountId}/access/groups/${config.cloudflareGroupId}`;
  const headers = { Authorization: `Bearer ${config.cloudflareApiToken}`, "Content-Type": "application/json" };
  const currentResponse = await fetch(endpoint, { headers, cache: "no-store" });
  if (!currentResponse.ok) throw new Error(`Cloudflare group lookup failed (${currentResponse.status}).`);
  const currentBody = (await currentResponse.json()) as { success: boolean; result?: CloudflareGroup };
  if (!currentBody.success || !currentBody.result) throw new Error("Cloudflare group lookup returned no group.");

  const normalizedEmail = email.trim().toLowerCase();
  const existing = currentBody.result.include ?? [];
  const withoutEmail = existing.filter((rule) => {
    const value = (rule.email as { email?: unknown } | undefined)?.email;
    return typeof value !== "string" || value.toLowerCase() !== normalizedEmail;
  });
  const include = shouldInclude
    ? [...withoutEmail, { email: { email: normalizedEmail } }]
    : withoutEmail;

  const updateResponse = await fetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      name: currentBody.result.name,
      include,
      exclude: currentBody.result.exclude ?? [],
      require: currentBody.result.require ?? [],
      is_default: currentBody.result.is_default ?? false,
    }),
  });
  if (!updateResponse.ok) throw new Error(`Cloudflare group update failed (${updateResponse.status}).`);
  return { skipped: false } as const;
}
