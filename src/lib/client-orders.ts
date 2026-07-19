import "server-only";

import { auth } from "@clerk/nextjs/server";

import { activeHub } from "@/constants/hub";
import { droneClassLabels } from "@/constants/domain";
import { calculateDistanceKm } from "@/lib/mission-route";
import { formatEstimatedCo2Saved, formatRoadDistanceAvoided } from "@/lib/eco";
import { getOrderProgress, getOrderTimelineLabels } from "@/lib/orders";
import { AddressesRepository } from "@/lib/repositories/addresses-repository";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ParcelsRepository } from "@/lib/repositories/parcels-repository";
import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  buildClientOrderDetail,
  mapOrderSummary,
} from "@/lib/client-orders-mappers";
import type {
  ClientFailedOrderSummary,
  ClientOrderDetail,
  ClientOrderSummary,
} from "@/types/client-orders";
import type { Order } from "@/types/order";
import type { Parcel } from "@/types/parcel";
import type { PaymentRecord } from "@/types/payment-record";
import type { Address } from "@/types/address";

type ClientOrdersData = {
  orders: Order[];
  addressesById: Map<string, Address>;
  parcelsById: Map<string, Parcel>;
  paymentsByOrderId: Map<string, PaymentRecord>;
};

async function getCurrentProfileContext() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const profiles = new ProfilesRepository(supabase);
  const profile = await profiles.getByClerkUserId(userId);

  if (!profile.ok || !profile.data) {
    return null;
  }

  return { profileId: profile.data.id, supabase };
}

async function loadClientOrdersData(): Promise<ClientOrdersData> {
  const context = await getCurrentProfileContext();

  if (!context) {
    return {
      orders: [],
      addressesById: new Map(),
      parcelsById: new Map(),
      paymentsByOrderId: new Map(),
    };
  }

  const { profileId, supabase } = context;
  const ordersRepo = new OrdersRepository(supabase);
  const addressesRepo = new AddressesRepository(supabase);
  const parcelsRepo = new ParcelsRepository(supabase);
  const paymentsRepo = new PaymentRecordsRepository(supabase);
  const ordersResult = await ordersRepo.listByProfileId(profileId, {
    limit: 100,
    orderBy: "created_at",
    descending: true,
  });

  if (!ordersResult.ok) {
    throw new Error(ordersResult.error.message);
  }

  const orders = ordersResult.data;
  const addressIds = new Set<string>();
  const parcelIds = new Set<string>();

  for (const order of orders) {
    addressIds.add(order.pickupAddressId);
    addressIds.add(order.dropoffAddressId);
    parcelIds.add(order.parcelId);
  }

  const addressEntries = await Promise.all(
    [...addressIds].map(async (id) => [id, await addressesRepo.getById(id)] as const),
  );
  const parcelEntries = await Promise.all(
    [...parcelIds].map(async (id) => [id, await parcelsRepo.getById(id)] as const),
  );
  const paymentsResult = await paymentsRepo.listByProfileId(profileId, {
    limit: 200,
  });

  const addressesById = new Map<string, Address>();
  const parcelsById = new Map<string, Parcel>();
  const paymentsByOrderId = new Map<string, PaymentRecord>();

  for (const [id, result] of addressEntries) {
    if (result.ok && result.data) {
      addressesById.set(id, result.data);
    }
  }

  for (const [id, result] of parcelEntries) {
    if (result.ok && result.data) {
      parcelsById.set(id, result.data);
    }
  }

  if (paymentsResult.ok) {
    for (const payment of paymentsResult.data) {
      const current = paymentsByOrderId.get(payment.orderId);

      if (!current || Date.parse(payment.createdAt) > Date.parse(current.createdAt)) {
        paymentsByOrderId.set(payment.orderId, payment);
      }
    }
  }

  return { orders, addressesById, parcelsById, paymentsByOrderId };
}

export async function getClientOrderSummaries(): Promise<ClientOrderSummary[]> {
  const data = await loadClientOrdersData();

  return data.orders.map((order) =>
    mapOrderSummary(order, data.addressesById, data.paymentsByOrderId.get(order.id) ?? null),
  );
}

export async function getClientFailedOrderSummaries(): Promise<ClientFailedOrderSummary[]> {
  const summaries = await getClientOrderSummaries();

  return summaries
    .filter((order) => order.statusFilter === "failed")
    .map(
      (order): ClientFailedOrderSummary => ({
        ...order,
        failureReason: "Livrarea a fost marcatÄƒ ca eÈ™uatÄƒ.",
        fallbackUsed: false,
        fallbackLabel: "VerificÄƒ detaliile comenzii",
        paymentIssueLabel: order.payment.hasPaymentIssue
          ? `${order.payment.statusLabel}: ${order.payment.methodDetail}`
          : null,
      }),
    );
}

export async function getClientOrderDetail(
  orderId: string,
): Promise<ClientOrderDetail | null> {
  const context = await getCurrentProfileContext();

  if (!context) {
    return null;
  }

  const { profileId, supabase } = context;
  const ordersRepo = new OrdersRepository(supabase);

  let orderResult = await ordersRepo.getByLocalOrderId(orderId);
  if (orderResult.ok && !orderResult.data) {
    orderResult = await ordersRepo.getById(orderId);
  }

  if (!orderResult.ok || !orderResult.data) {
    return null;
  }

  const order = orderResult.data;

  if (order.senderProfileId !== profileId) {
    return null;
  }

  return buildClientOrderDetail(supabase, order);
}
