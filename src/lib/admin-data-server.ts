

import "server-only";

import { activeHub } from "@/constants/hub";
import {
  contactMessageStatusLabels,
  operationalPlatformStatusLabels,
} from "@/lib/admin-data";
import { getAdminContactMessageDetails } from "@/lib/admin-contact-messages";
import { getAdminLockerRecoveryDetails } from "@/lib/admin-locker-recoveries";
import { getAdminFailedOrderDetails } from "@/lib/admin-failed-orders";
import { getAdminStatisticsSnapshot } from "@/lib/admin-statistics";
import { getAdminOperationalCenterData } from "@/lib/admin-operational-center";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ContactMessagesRepository } from "@/lib/repositories/contact-messages-repository";
import { OperationalSettingsRepository } from "@/lib/repositories/operational-settings-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AdminContactMessageDetail } from "@/types/admin-contact";
import type { AdminFailedOrderDetail } from "@/types/admin-failed-orders";
import type { AdminLockerRecoveryDetail } from "@/types/admin-locker-recoveries";
import type { AdminStatisticsSnapshot } from "@/types/admin-statistics";
import type { OperationalCenterData } from "@/types/admin-operational";
import type {
  AdminOrder,
  ContactMessage as AdminContactMessage,
  OperationalPlatformStatus,
  OperationalSettings as AdminOperationalSettings,
} from "@/types/admin";
import type { ContactMessage as RepoContactMessage } from "@/types/contact-message";
import type { OperationalSettings as RepoOperationalSettings } from "@/types/operational-settings";
import type { AddressSnapshot } from "@/types/entities";

import { mapRepoOrderToAdminOrder } from "@/lib/admin-order-mapper";
export { mapRepoOrderToAdminOrder } from "@/lib/admin-order-mapper";

function mapRepoContactMessageToAdmin(
  msg: RepoContactMessage,
): AdminContactMessage {

  const status = msg.status;

  return {
    id: msg.id,
    source: "supabase",
    persistence: "persisted",
    email: msg.senderEmail,
    subject: msg.subject,
    category: msg.category ?? "unknown",
    message: msg.body,
    status,
    statusLabel: contactMessageStatusLabels[status],
    internalNote: msg.internalNote,
    preparedReply: null,
    readAt: msg.readAt,
    archivedAt: null,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };
}

function mapRepoSettingsToAdmin(
  settings: RepoOperationalSettings,
): AdminOperationalSettings {
  const platformStatus: OperationalPlatformStatus = settings.isActive
    ? "active"
    : "maintenance";

  const hubAddress: AddressSnapshot = {
    formattedAddress: activeHub.address.formattedAddress,
    city: activeHub.address.city,
    county: activeHub.address.county,
    country: activeHub.address.country,
    location: {
      latitude: settings.hubLatitude,
      longitude: settings.hubLongitude,
    },
  };

  return {
    id: "default",
    source: "supabase",
    persistence: "persisted",
    serviceRadiusKm: settings.serviceRadiusKm,
    hubAddress,
    basePrice: { amountMinor: settings.basePriceMinor, currency: "RON" },
    pricePerKm: { amountMinor: settings.pricePerKmMinor, currency: "RON" },
    timeouts: {
      meetingPointConfirmationMinutes: settings.confirmationTimerMinutes,
      parcelLoadMinutes: settings.loadingTimerMinutes,
      parcelUnloadMinutes: settings.unloadingTimerMinutes,
    },
    platformStatus,
    platformStatusLabel: operationalPlatformStatusLabels[platformStatus],
    updatedAt: settings.updatedAt,
    updatedBy: settings.lastSavedBy,
  };
}

export async function getAdminOrdersFromDB(): Promise<AdminOrder[]> {
  const supabase = createAdminSupabaseClient();
  const repo = new OrdersRepository(supabase);
  const result = await repo.listAll({ limit: 200 });

  if (!result.ok) {
    console.error("[admin-data-server] getAdminOrdersFromDB failed:", result.error);
    return [];
  }

  return result.data.map(mapRepoOrderToAdminOrder);
}

export async function getAdminContactMessagesFromDB(): Promise<AdminContactMessage[]> {
  const supabase = createAdminSupabaseClient();
  const repo = new ContactMessagesRepository(supabase);
  const result = await repo.list({ limit: 200 });

  if (!result.ok) {
    console.error("[admin-data-server] getAdminContactMessagesFromDB failed:", result.error);
    return [];
  }

  return result.data.map(mapRepoContactMessageToAdmin);
}

export async function getAdminOperationalSettingsFromDB(): Promise<AdminOperationalSettings | null> {
  const supabase = createAdminSupabaseClient();
  const repo = new OperationalSettingsRepository(supabase);
  const result = await repo.getCurrent();

  if (!result.ok) {
    console.error("[admin-data-server] getAdminOperationalSettingsFromDB failed:", result.error);
    return null;
  }

  return mapRepoSettingsToAdmin(result.data);
}

export async function getAdminContactMessageDetailsFromDB(): Promise<AdminContactMessageDetail[]> {
  const messages = await getAdminContactMessagesFromDB();
  return getAdminContactMessageDetails(messages);
}

export async function getAdminStatisticsSnapshotFromDB(): Promise<AdminStatisticsSnapshot> {
  const orders = await getAdminOrdersFromDB();
  return getAdminStatisticsSnapshot(orders);
}

export async function getAdminFailedOrderDetailsFromDB(): Promise<AdminFailedOrderDetail[]> {
  const orders = await getAdminOrdersFromDB();
  return getAdminFailedOrderDetails(orders);
}

export async function getAdminLockerRecoveryDetailsFromDB(): Promise<AdminLockerRecoveryDetail[]> {
  const orders = await getAdminOrdersFromDB();
  return getAdminLockerRecoveryDetails(orders);
}

export async function getAdminOperationalCenterDataFromDB(): Promise<OperationalCenterData> {
  const [orders, rawMessages, settings] = await Promise.all([
    getAdminOrdersFromDB(),
    getAdminContactMessagesFromDB(),
    getAdminOperationalSettingsFromDB(),
  ]);

  const contactMessages = getAdminContactMessageDetails(rawMessages);

  return getAdminOperationalCenterData({
    adminOrders: orders,
    contactMessages,
    settings: settings ?? undefined,
  });
}
