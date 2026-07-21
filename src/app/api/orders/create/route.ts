

import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AddressesRepository } from "@/lib/repositories/addresses-repository";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ParcelsRepository } from "@/lib/repositories/parcels-repository";
import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createCompleteHandoffSnapshot } from "@/lib/meeting-point-snapshot";
import { ensureOrderMission } from "@/lib/mission-bootstrap-server";
import type { CreateDeliveryPayload } from "@/types/create-delivery";
import type {
  DispatchTiming,
  HandoffPointsSnapshot,
  PaymentStatus,
  PricingSnapshot,
  PricingSurcharge,
  StoredHandoffPoint,
} from "@/types/order";
import type { SkySendPricingResult } from "@/types/pricing";

const CreateOrderBodySchema = z.object({

  payload: z.record(z.string(), z.unknown()),

  localOrderId: z.string().min(1),

  publicTrackingCode: z.string().min(1),

  recipientTrackingToken: z.string().min(1),
  paymentStatus: z.string().optional(),
  stripePaymentIntentId: z.string().nullable().optional(),
});

function buildSurcharges(pricing: SkySendPricingResult): PricingSurcharge[] {
  const surcharges: PricingSurcharge[] = [];

  const add = (type: string, amount: number, label: string) => {
    if (amount !== 0) surcharges.push({ type, amount, label });
  };

  add("weight_surcharge", pricing.weightSurcharge?.amountMinor ?? 0, "Suprataxă greutate");
  add("fragile_handling", pricing.fragileHandlingSurcharge?.amountMinor ?? 0, "Manipulare fragil");
  add("thermal_handling", pricing.thermalHandlingSurcharge?.amountMinor ?? 0, "Control termic");
  add("secure_handling", pricing.secureHandlingSurcharge?.amountMinor ?? 0, "Securitate plus");
  add("route_complexity", pricing.routeComplexityAdjustment?.amountMinor ?? 0, "Traseu și compatibilitate locker");
  add("drone_model", pricing.droneModelAdjustment?.amountMinor ?? 0, "Model dronă");
  add(
    "delivery_config",
    pricing.deliveryConfigurationAdjustment?.amountMinor ?? 0,
    "Configurație cargo",
  );

  return surcharges;
}

function pricingSnapshotFromResult(pricing: SkySendPricingResult): PricingSnapshot {
  const snapshot: PricingSnapshot = {
    version: pricing.version,
    baseFee: pricing.baseFee.amountMinor,
    distanceFee: pricing.distanceFee.amountMinor,

    configMultiplier: 1,
    dispatchAdjustment: pricing.dispatchTimingAdjustment.amountMinor,
    surcharges: buildSurcharges(pricing),
    subtotal: pricing.subtotal.amountMinor,
    total: pricing.total.amountMinor,
  };

  const scheduledMinor = pricing.scheduledAdjustment?.amountMinor ?? 0;
  if (scheduledMinor !== 0) {
    snapshot.scheduledAdjustment = scheduledMinor;
  }

  return snapshot;
}

function toStoredHandoffPoint(
  point: CreateDeliveryPayload["selectedPickupPoint"] | null | undefined,
): StoredHandoffPoint | null {
  if (!point) return null;
  return {
    id: point.id,
    label: point.label,
    location: {
      latitude: point.location.latitude,
      longitude: point.location.longitude,
    },
    type: point.type,
    smartScore: point.smartScore,
    eligibility: {
      state: point.eligibilityState,
      message: String(point.recommendationState),
    },
  };
}

export async function POST(request: Request) {

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: z.infer<typeof CreateOrderBodySchema>;
  try {
    body = CreateOrderBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = body.payload as CreateDeliveryPayload;

  const adminSupabase = createAdminSupabaseClient();

  const profiles = new ProfilesRepository(adminSupabase);
  const profileResult = await profiles.getByClerkUserId(userId);
  if (!profileResult.ok || !profileResult.data) {
    return NextResponse.json(
      { error: "Profile not found for this user." },
      { status: 404 },
    );
  }
  const profileId = profileResult.data.id;

  const addresses = new AddressesRepository(adminSupabase);
  const parcels = new ParcelsRepository(adminSupabase);
  const orders = new OrdersRepository(adminSupabase);
  const paymentRecords = new PaymentRecordsRepository(adminSupabase);

  const existingOrderResult = await orders.getByLocalOrderId(body.localOrderId);
  if (!existingOrderResult.ok) {
    console.error(
      "[orders/create] Failed to look up existing order:",
      existingOrderResult.error,
    );
    return NextResponse.json({ error: "Failed to create order." }, { status: 502 });
  }

  if (existingOrderResult.data) {
    const existing = existingOrderResult.data;

    if (existing.senderProfileId !== profileId) {
      return NextResponse.json({ error: "Failed to create order." }, { status: 409 });
    }

    const paymentStatus = (body.paymentStatus as PaymentStatus) ?? "pending";
    const updatePatch: Parameters<typeof orders.updateById>[1] = {};

    if (body.paymentStatus !== undefined) {
      updatePatch.paymentStatus = paymentStatus;
    }
    if (body.stripePaymentIntentId !== undefined) {
      updatePatch.stripePaymentIntentId = body.stripePaymentIntentId ?? null;
    }
    if (existing.fulfillmentStatus === null) {
      updatePatch.fulfillmentStatus = "order_created";
    }
    if (paymentStatus === "paid") {
      updatePatch.status = "in_progress";
      updatePatch.fulfillmentStatus = "active_mission";
    }

    let savedOrder = existing;
    if (Object.keys(updatePatch).length > 0) {
      const updated = await orders.updateById(existing.id, updatePatch);
      if (!updated.ok) {
        console.error(
          "[orders/create] Failed to update existing order:",
          updated.error,
        );
        return NextResponse.json(
          { error: "Failed to create order." },
          { status: 502 },
        );
      }
      savedOrder = updated.data;
    }

    if (updatePatch.paymentStatus === "paid") {
      await ensurePaymentRecord(paymentRecords, {
        orderId: existing.id,
        profileId,
        stripePaymentIntentId:
          updatePatch.stripePaymentIntentId ?? existing.stripePaymentIntentId,
        amountMinor: existing.totalAmountMinor,
        currency: existing.currency,
      });
    }

    if (paymentStatus === "paid") {
      await ensureOrderMission(adminSupabase, savedOrder);
    }

    return NextResponse.json({
      ok: true,
      supabaseOrderId: existing.id,
      localOrderId: body.localOrderId,
      publicTrackingCode: existing.publicTrackingCode,
      recipientTrackingToken: existing.recipientTrackingToken,
    });
  }

  const pickupAddrResult = await addresses.create({
    profileId,
    formattedAddress: payload.pickupAddress.formattedAddress,
    city: payload.pickupAddress.city,
    county: payload.pickupAddress.county,
    country: payload.pickupAddress.country,
    postalCode: payload.pickupAddress.postalCode,
    latitude: payload.pickupAddress.location.latitude,
    longitude: payload.pickupAddress.location.longitude,
    isSaved: false,
  });
  if (!pickupAddrResult.ok) {
    console.error("[orders/create] Failed to create pickup address:", pickupAddrResult.error);
    return NextResponse.json({ error: "Failed to create pickup address." }, { status: 502 });
  }

  const dropoffAddrResult = await addresses.create({
    profileId,
    formattedAddress: payload.dropoffAddress.formattedAddress,
    city: payload.dropoffAddress.city,
    county: payload.dropoffAddress.county,
    country: payload.dropoffAddress.country,
    postalCode: payload.dropoffAddress.postalCode,
    latitude: payload.dropoffAddress.location.latitude,
    longitude: payload.dropoffAddress.location.longitude,
    isSaved: false,
  });
  if (!dropoffAddrResult.ok) {
    console.error("[orders/create] Failed to create dropoff address:", dropoffAddrResult.error);
    return NextResponse.json({ error: "Failed to create dropoff address." }, { status: 502 });
  }

  const parcelDraft = payload.parcel;
  const hasDimensions =
    parcelDraft.lengthCm !== null &&
    parcelDraft.widthCm !== null &&
    parcelDraft.heightCm !== null;

  const parcelResult = await parcels.create({
    contentsDescription: parcelDraft.contentDescription,
    fragilityLevel: parcelDraft.fragilityLevel,
    packagingType: parcelDraft.packaging,
    approximateSize: parcelDraft.approximateSize,
    declaredWeightKg: parcelDraft.weightKg,
    estimatedWeightRange: parcelDraft.estimatedWeightRange,
    thermalProtection:
      payload.selectedDeliveryConfiguration?.protection.temperatureProtection ?? "none",
    declaredDimensionsCm: hasDimensions
      ? {
          lengthCm: parcelDraft.lengthCm!,
          widthCm: parcelDraft.widthCm!,
          heightCm: parcelDraft.heightCm!,
        }
      : null,
  });
  if (!parcelResult.ok) {
    console.error("[orders/create] Failed to create parcel:", parcelResult.error);
    return NextResponse.json({ error: "Failed to create parcel." }, { status: 502 });
  }

  const pricingSnapshot = pricingSnapshotFromResult(payload.pricingSnapshot);

  const pickupHandoffPoint = toStoredHandoffPoint(payload.selectedPickupPoint);
  const dropoffHandoffPoint = toStoredHandoffPoint(payload.selectedDropoffPoint);
  const handoffPointsSnapshot: HandoffPointsSnapshot | null =
    pickupHandoffPoint && dropoffHandoffPoint
      ? createCompleteHandoffSnapshot(payload)
      : null;

  const dispatchTiming = payload.urgency as DispatchTiming;

  const deliveryConfigurationId =
    payload.selectedDeliveryConfiguration?.id ?? "default";

  const orderResult = await orders.create({
    localOrderId: body.localOrderId,
    publicTrackingCode: body.publicTrackingCode,
    recipientTrackingToken: body.recipientTrackingToken,
    senderProfileId: profileId,
    pickupAddressId: pickupAddrResult.data.id,
    dropoffAddressId: dropoffAddrResult.data.id,
    parcelId: parcelResult.data.id,
    status: body.paymentStatus === "paid" ? "in_progress" : "pending",
    fulfillmentStatus:
      body.paymentStatus === "paid" ? "active_mission" : "order_created",
    dispatchTiming,
    scheduledAt: payload.scheduledAt ?? null,
    droneClass: payload.recommendedDroneClass,
    deliveryConfigurationId,
    etaMinMinutes: payload.estimatedEta?.minMinutes ?? null,
    etaMaxMinutes: payload.estimatedEta?.maxMinutes ?? null,
    totalAmountMinor: payload.pricingSnapshot.total.amountMinor,
    currency: payload.pricingSnapshot.currency ?? "RON",
    pricingSnapshot,
    handoffPointsSnapshot,
    selectedPickupHandoffPoint: pickupHandoffPoint,
    selectedDropoffHandoffPoint: dropoffHandoffPoint,
    paymentStatus: (body.paymentStatus as PaymentStatus) ?? "pending",
    stripePaymentIntentId: body.stripePaymentIntentId ?? null,
  });

  if (!orderResult.ok) {
    console.error("[orders/create] Failed to create order:", orderResult.error);
    return NextResponse.json({ error: "Failed to create order." }, { status: 502 });
  }

  if ((body.paymentStatus as PaymentStatus | undefined) === "paid") {
    await ensurePaymentRecord(paymentRecords, {
      orderId: orderResult.data.id,
      profileId,
      stripePaymentIntentId: body.stripePaymentIntentId ?? null,
      amountMinor: orderResult.data.totalAmountMinor,
      currency: orderResult.data.currency,
    });
    await ensureOrderMission(adminSupabase, orderResult.data);
  }

  return NextResponse.json({
    ok: true,
    supabaseOrderId: orderResult.data.id,
    localOrderId: body.localOrderId,
    publicTrackingCode: body.publicTrackingCode,
    recipientTrackingToken: body.recipientTrackingToken,
  });
}

async function ensurePaymentRecord(
  paymentRecords: PaymentRecordsRepository,
  input: {
    orderId: string;
    profileId: string;
    stripePaymentIntentId: string | null;
    amountMinor: number;
    currency: string;
  },
): Promise<void> {
  const existing = await paymentRecords.listByOrderId(input.orderId);
  const matches =
    existing.ok &&
    existing.data.some(
      (record) =>
        record.type === "payment" &&
        record.status === "succeeded" &&
        (record.stripePaymentIntentId === input.stripePaymentIntentId ||
          record.amountMinor === input.amountMinor),
    );

  if (matches) {
    return;
  }

  await paymentRecords.create({
    orderId: input.orderId,
    profileId: input.profileId,
    stripePaymentIntentId: input.stripePaymentIntentId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    type: "payment",
    status: "succeeded",
  });
}
