import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest } from "@/lib/api/validation";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { grantAdminSettingsAccess, isAdminSettingsCodeConfigured } from "@/lib/admin-settings-access";

const schema = z.object({ code: z.string().regex(/^\d{6}$/u) }).strict();
export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(["admin"]);
  if (!authorization.ok) return authorization.response;
  if (!isAdminSettingsCodeConfigured()) return NextResponse.json({ error: "settings_code_not_configured" }, { status: 503 });
  const parsed = await validateRequest(schema, request, { maxBytes: 2 * 1024 });
  if (!parsed.ok) return parsed.response;
  const granted = await grantAdminSettingsAccess(parsed.data.code);
  return granted ? NextResponse.json({ ok: true, expiresInSeconds: 180 }) : NextResponse.json({ error: "invalid_code" }, { status: 401 });
}
