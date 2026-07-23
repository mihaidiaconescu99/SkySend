import { auth } from "@clerk/nextjs/server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createR2DownloadUrl } from "@/lib/storage/r2";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, context: { params: Promise<{ documentId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { documentId } = await context.params;
  const supabase = createAdminSupabaseClient();
  const profile = await new ProfilesRepository(supabase).getByClerkUserId(userId);
  if (!profile.ok || !profile.data) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  const database = supabase as any;
  const { data } = await database.from("billing_documents")
    .select("id,document_number,pdf_object_key,generation_status,order:orders!inner(sender_profile_id)")
    .eq("id", documentId).maybeSingle();
  if (!data || data.order?.sender_profile_id !== profile.data.id) {
    return NextResponse.json({ error: "document_not_found" }, { status: 404 });
  }
  if (data.generation_status !== "ready" || !data.pdf_object_key) {
    return NextResponse.json({ error: "document_not_ready" }, { status: 409 });
  }
  return NextResponse.redirect(
    await createR2DownloadUrl(data.pdf_object_key, `${data.document_number}.pdf`),
    302,
  );
}
