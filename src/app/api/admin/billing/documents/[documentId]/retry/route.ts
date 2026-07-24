import { NextResponse } from "next/server";
import { z } from "zod";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireAdminPanelUser } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const { documentId } = await context.params;
  if (!z.string().uuid().safeParse(documentId).success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const { data, error } = await (createAdminSupabaseClient() as any)
    .from("billing_documents")
    .update({
      generation_status: "pending",
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", documentId)
    .eq("generation_status", "failed")
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "retry_failed" }, { status: 502 });
  if (!data) return NextResponse.json({ error: "document_not_failed" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
