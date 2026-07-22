import "server-only";

import { serviceAreaConfig } from "@/constants/service-area";
import { getAdminOperationalSettingsFromDB } from "@/lib/admin-data-server";
import { defaultOperationalSettings } from "@/lib/admin-data";
import { normalizeAssistantText } from "@/lib/ai/skysend-assistant-knowledge";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AssistantOrderContext, AssistantRuntimeContext } from "@/types/assistant";
import type { Order } from "@/types/order";

const orderIdentifierPattern = /(?:SKY-[A-Z]{2}-\d{5}-\d{3}|[0-9a-f]{8}-[0-9a-f-]{27,})/iu;

export function toAssistantOrderContext(order: Order): AssistantOrderContext {
  return {
    localOrderId: order.localOrderId,
    status: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
    deliveryType: order.dispatchTiming,
    scheduledAt: order.scheduledAt,
    etaMinMinutes: order.etaMinMinutes,
    etaMaxMinutes: order.etaMaxMinutes,
    amountMinor: order.totalAmountMinor,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    refundStatus: order.refundStatus,
    updatedAt: order.updatedAt,
    detailHref: `/client/orders/${encodeURIComponent(order.localOrderId)}`,
  };
}

export function requestsPersonalOrderContext(message: string) {
  const query = normalizeAssistantText(message);
  return Boolean(
    message.match(orderIdentifierPattern) ||
      /(comenzile? (mea|mele)|mele comenzi|ultima comanda|plata mea|rambursarea mea|statusul comenzii|my orders?|my payment|my refund|order status)/u.test(query),
  );
}

export async function buildAssistantRuntimeContext(input: {
  message: string;
  profileId?: string | null;
}): Promise<AssistantRuntimeContext> {
  const configured = await getAdminOperationalSettingsFromDB().catch(() => null);
  const operational = configured ?? defaultOperationalSettings;
  const context: AssistantRuntimeContext = {
    operational: {
      platformStatus: operational.platformStatus,
      city: operational.hubAddress.city ?? serviceAreaConfig.cityName,
      county: operational.hubAddress.county ?? serviceAreaConfig.county,
      country: operational.hubAddress.country ?? serviceAreaConfig.country,
      radiusKm: operational.serviceRadiusKm,
      basePriceMinor: operational.basePrice.amountMinor,
      pricePerKmMinor: operational.pricePerKm.amountMinor,
      currency: operational.basePrice.currency,
      timers: operational.timeouts,
    },
    account: {
      authenticated: Boolean(input.profileId),
      orders: [],
    },
  };

  if (!input.profileId || !requestsPersonalOrderContext(input.message)) return context;

  const repository = new OrdersRepository(createAdminSupabaseClient());
  const recent = await repository.listByProfileId(input.profileId, {
    limit: 5,
    orderBy: "updated_at",
    descending: true,
  });
  if (recent.ok) context.account.orders = recent.data.map(toAssistantOrderContext);

  const identifier = input.message.match(orderIdentifierPattern)?.[0];
  if (!identifier) return context;
  let found = await repository.getByLocalOrderId(identifier);
  if (found.ok && !found.data) found = await repository.getById(identifier);
  if (found.ok && found.data?.senderProfileId === input.profileId) {
    context.account.selectedOrder = toAssistantOrderContext(found.data);
  }
  return context;
}
