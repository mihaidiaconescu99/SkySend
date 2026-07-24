import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Order } from "@/types/order";
import type { TrackingLinkScope } from "@/types/mission-record";

export type TrackingAccessScope = "owner" | "full" | "pickup" | "dropoff" | "view";
export type DirectTrackingCredential = "public_identifier" | "recipient_token";

const terminalOrderStatuses = new Set(["completed", "failed", "cancelled"]);

function createToken(scope: TrackingLinkScope) {
  return `trk_${scope}_${randomBytes(24).toString("base64url")}`;
}

export function isOrderTerminal(order: Order) {
  return terminalOrderStatuses.has(order.status);
}

export async function expireTrackingLinksAfterTerminal(
  db: SupabaseClient<Database>,
  orderId: string,
  terminalAt = new Date(),
) {
  const expiresAt = new Date(
    terminalAt.getTime() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await db
    .from("order_tracking_links")
    .update({ expires_at: expiresAt, updated_at: terminalAt.toISOString() })
    .eq("order_id", orderId)
    .is("expires_at", null);
  if (error) throw error;
}

export async function ensureTrackingLinks(
  db: SupabaseClient<Database>,
  order: Order,
) {
  const { data: existing, error } = await db
    .from("order_tracking_links")
    .select("*")
    .eq("order_id", order.id);

  if (error) throw error;

  const scopes = ["full", "pickup", "dropoff"] as const;
  const rows = [...(existing ?? [])];
  if (isOrderTerminal(order)) {
    const terminalExpiry = new Date(
      Math.max(Date.parse(order.updatedAt), Date.now()) + 14 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await db
      .from("order_tracking_links")
      .update({ expires_at: terminalExpiry, updated_at: new Date().toISOString() })
      .eq("order_id", order.id)
      .is("expires_at", null);
    rows.forEach((row) => {
      row.expires_at ??= terminalExpiry;
    });
  }

  for (const scope of scopes) {
    const active = rows.find((row) => row.scope === scope && !row.revoked_at);
    if (active || isOrderTerminal(order)) continue;

    const { data, error: insertError } = await db
      .from("order_tracking_links")
      .upsert(
        {
          order_id: order.id,
          scope,
          token: createToken(scope),
          revoked_at: null,
          expires_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id,scope" },
      )
      .select("*")
      .single();

    if (insertError) throw insertError;
    rows.push(data);
  }

  return rows.filter((row) => !row.revoked_at);
}

export async function rotateTrackingLink(
  db: SupabaseClient<Database>,
  orderId: string,
  scope: TrackingLinkScope,
) {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("order_tracking_links")
    .upsert(
      {
        order_id: orderId,
        scope,
        token: createToken(scope),
        revoked_at: null,
        expires_at: null,
        updated_at: now,
      },
      { onConflict: "order_id,scope" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function resolveTrackingToken(
  db: SupabaseClient<Database>,
  token: string,
) {
  const { data, error } = await db
    .from("order_tracking_links")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.revoked_at) return null;
  if (data.expires_at && Date.parse(data.expires_at) <= Date.now()) return null;
  return data;
}

export function getActionCapabilities(scope: TrackingAccessScope) {
  return {
    canPickup: scope === "owner" || scope === "full" || scope === "pickup",
    canDropoff: scope === "owner" || scope === "full" || scope === "dropoff",
    canManageSharing: scope === "owner",
  };
}

export function getDirectTrackingScope(
  credential: DirectTrackingCredential,
): TrackingAccessScope {
  return credential === "recipient_token" ? "full" : "view";
}
