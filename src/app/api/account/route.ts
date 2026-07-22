import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";

type DeleteAccountBody = { confirmation?: string };

function escapeStripeSearch(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Autentificarea este necesară." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as DeleteAccountBody | null;
  if (body?.confirmation !== "ȘTERGE") {
    return NextResponse.json({ error: "Confirmarea ȘTERGE este necesară." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: "Contul nu a putut fi verificat." }, { status: 500 });

  if (profile) {
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id,status,fulfillment_status,scheduled_at,pickup_address_id,dropoff_address_id")
      .eq("sender_profile_id", profile.id);
    if (ordersError) return NextResponse.json({ error: "Livrările contului nu au putut fi verificate." }, { status: 500 });

    const now = Date.now();
    const hasOutstandingDelivery = (orders ?? []).some((order) => {
      const terminal = ["completed", "failed", "cancelled"].includes(order.status) ||
        ["completed_mission", "failed_mission", "fallback_required", "canceled"].includes(order.fulfillment_status ?? "");
      return !terminal && (order.status === "in_progress" || order.fulfillment_status === "active_mission" ||
        (Boolean(order.scheduled_at) && Date.parse(order.scheduled_at ?? "") > now));
    });
    if (hasOutstandingDelivery) {
      return NextResponse.json(
        { error: "Contul nu poate fi șters cât timp există o livrare activă sau programată." },
        { status: 409 },
      );
    }

    try {
      const stripe = getStripeServer();
      const customers = await stripe.customers.search({
        query: `metadata['clerkUserId']:'${escapeStripeSearch(userId)}'`,
        limit: 10,
      });
      await Promise.all(customers.data.filter((customer) => !customer.deleted).map((customer) => stripe.customers.del(customer.id)));
    } catch (error) {
      console.error("[account-delete] stripe cleanup failed", error);
      return NextResponse.json({ error: "Cardurile salvate nu au putut fi eliminate. Reîncearcă." }, { status: 502 });
    }

    const retainedAddressIds = Array.from(new Set((orders ?? []).flatMap((order) => [order.pickup_address_id, order.dropoff_address_id])));
    const cleanupResults = await Promise.all([
      supabase.from("notifications").delete().eq("profile_id", profile.id),
      supabase.from("delivery_drafts").delete().eq("profile_id", profile.id),
      supabase.from("assistant_conversations").delete().eq("profile_id", profile.id),
      retainedAddressIds.length
        ? supabase.from("addresses").delete().eq("profile_id", profile.id).not("id", "in", `(${retainedAddressIds.join(",")})`)
        : supabase.from("addresses").delete().eq("profile_id", profile.id),
    ]);
    if (cleanupResults.some((result) => result.error)) {
      console.error("[account-delete] personal data cleanup failed", cleanupResults.map((result) => result.error));
      return NextResponse.json({ error: "Datele personale nu au putut fi eliminate complet. Reîncearcă." }, { status: 500 });
    }

    if (retainedAddressIds.length) {
      const { error } = await supabase.from("addresses").update({ profile_id: null, label: null, is_saved: false }).in("id", retainedAddressIds);
      if (error) return NextResponse.json({ error: "Adresele operaționale nu au putut fi anonimizate." }, { status: 500 });
    }

    const deletedIdentity = `deleted_${profile.id}`;
    const { error: anonymizeError } = await supabase.from("profiles").update({
      clerk_user_id: deletedIdentity,
      email: `${deletedIdentity}@deleted.invalid`,
      full_name: null,
      avatar_url: null,
      notification_preferences: { popup: false, email: false },
      updated_at: new Date().toISOString(),
    }).eq("id", profile.id);
    if (anonymizeError) return NextResponse.json({ error: "Profilul nu a putut fi anonimizat." }, { status: 500 });

    await supabase.from("audit_events").insert({
      actor_profile_id: profile.id,
      actor_role: "client",
      action: "account_deleted",
      entity_type: "profile",
      entity_id: profile.id,
      changes: { anonymized: true },
    });
  }

  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);
  } catch (error) {
    console.error("[account-delete] clerk deletion failed", error);
    return NextResponse.json({ error: "Identitatea contului nu a putut fi eliminată. Reîncearcă." }, { status: 502 });
  }

  return NextResponse.json({ deleted: true });
}
