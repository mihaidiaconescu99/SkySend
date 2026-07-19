import { NextResponse } from "next/server";
import { z } from "zod";
import { grantAdminSettingsAccess, isAdminSettingsCodeConfigured } from "@/lib/admin-settings-access";
import { requireAdminRoute } from "@/lib/protected-routes";

const schema = z.object({ code: z.string().regex(/^\d{6}$/u) });
export async function POST(request: Request) {
  const context = await requireAdminRoute();
  if (!context.canAccessAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isAdminSettingsCodeConfigured()) return NextResponse.json({ error: "settings_code_not_configured" }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  const granted = await grantAdminSettingsAccess(parsed.data.code);
  return granted ? NextResponse.json({ ok: true, expiresInSeconds: 180 }) : NextResponse.json({ error: "invalid_code" }, { status: 401 });
}
