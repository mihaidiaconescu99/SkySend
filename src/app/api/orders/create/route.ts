import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { deliveryConfigurations } from "@/constants/delivery-configurations";
import { calculateDistanceKm } from "@/lib/geo/distance";
import { createCompleteHandoffSnapshot } from "@/lib/meeting-point-snapshot";
import { assertOperationsAvailable } from "@/lib/operational-status-server";
import { calculateSkySendPricing } from "@/lib/pricing";
import { AddressesRepository } from "@/lib/repositories/addresses-repository";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ParcelsRepository } from "@/lib/repositories/parcels-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CreateDeliveryPayload } from "@/types/create-delivery";
import type {
  DispatchTiming,
  HandoffPointsSnapshot,
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
  locale: z.enum(["ro", "en"]).default("ro"),
});

function buildSurcharges(pricing: SkySendPricingResult): PricingSurcharge[] {
  const values: Array<[string, number, string]> = [
    ["weight_surcharge", pricing.weightSurcharge.amountMinor, "Suprataxă greutate"],
    ["fragile_handling", pricing.fragileHandlingSurcharge.amountMinor, "Manipulare fragilă"],
    ["thermal_handling", pricing.thermalHandlingSurcharge?.amountMinor ?? 0, "Control termic"],
    ["secure_handling", pricing.secureHandlingSurcharge?.amountMinor ?? 0, "Securitate plus"],
    ["route_complexity", pricing.routeComplexityAdjustment.amountMinor, "Complexitate traseu"],
    ["drone_model", pricing.droneModelAdjustment.amountMinor, "Model dronă"],
    ["delivery_config", pricing.deliveryConfigurationAdjustment?.amountMinor ?? 0, "Configurație cargo"],
  ];
  return values
    .filter(([, amount]) => amount !== 0)
    .map(([type, amount, label]) => ({ type, amount, label }));
}

function pricingSnapshotFromResult(pricing: SkySendPricingResult): PricingSnapshot {
  return {
    version: pricing.version,
    baseFee: pricing.baseFee.amountMinor,
    distanceFee: pricing.distanceFee.amountMinor,
    configMultiplier: 1,
    dispatchAdjustment: pricing.dispatchTimingAdjustment.amountMinor,
    scheduledAdjustment: pricing.scheduledAdjustment.amountMinor || undefined,
    surcharges: buildSurcharges(pricing),
    subtotal: pricing.subtotal.amountMinor,
    total: pricing.total.amountMinor,
  };
}

function toStoredHandoffPoint(
  point: CreateDeliveryPayload["selectedPickupPoint"] | null | undefined,
): StoredHandoffPoint | null {
  if (!point) return null;
  return {
    id: point.id,
    label: point.label,
    location: point.location,
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
  const supabase = createAdminSupabaseClient();
  const profiles = new ProfilesRepository(supabase);
  const profileResult = await profiles.getByClerkUserId(userId);
  if (!profileResult.ok || !profileResult.data) {
    return NextResponse.json({ error: "Profile not found for this user." }, { status: 404 });
  }
  const profileId = profileResult.data.id;
  const orders = new OrdersRepository(supabase);
  const existingOrderResult = await orders.getByLocalOrderId(body.localOrderId);
  if (!existingOrderResult.ok) {
    return NextResponse.json({ error: "Failed to create order." }, { status: 502 });
  }
  if (existingOrderResult.data) {
    const existing = existingOrderResult.data;
    if (existing.senderProfileId !== profileId) {
      return NextResponse.json({ error: "Order identifier conflict." }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      supabaseOrderId: existing.id,
      localOrderId: existing.localOrderId,
      publicTrackingCode: existing.publicTrackingCode,
      recipientTrackingToken: existing.recipientTrackingToken,
      totalAmountMinor: existing.totalAmountMinor,
      currency: existing.currency,
    });
  }

  try {
    await assertOperationsAvailable(supabase);
  } catch {
    return NextResponse.json(
      { error: "operations_temporarily_unavailable" },
      { status: 423 },
    );
  }

  const { data: settings, error: settingsError } = await supabase
    .from("operational_settings")
    .select("base_price_minor, price_per_km_minor, hub_latitude, hub_longitude")
    .limit(1)
    .single();
  if (settingsError || !settings) {
    return NextResponse.json({ error: "Operational pricing is unavailable." }, { status: 503 });
  }

  const pickupPoint = payload.selectedPickupPoint?.location;
  const dropoffPoint = payload.selectedDropoffPoint?.location;
  if (!pickupPoint || !dropoffPoint) {
    return NextResponse.json({ error: "Delivery points are required." }, { status: 400 });
  }
  const distanceKm =
    calculateDistanceKm(
      { latitude: settings.hub_latitude, longitude: settings.hub_longitude },
      pickupPoint,
    ) + calculateDistanceKm(pickupPoint, dropoffPoint);
  const configuration = deliveryConfigurations.find(
    (item) => item.id === payload.selectedDeliveryConfiguration?.id,
  );
  const pricing = calculateSkySendPricing(
    {
      pickupCoordinates: pickupPoint,
      dropoffCoordinates: dropoffPoint,
      distanceKm,
      selectedDroneId: payload.recommendedDroneClass,
      deliveryConfiguration: configuration ?? null,
      dispatchTiming: payload.urgency,
      scheduledAt: payload.scheduledAt,
      weightKg: payload.parcel.weightKg,
      dimensionsCm: {
        lengthCm: payload.parcel.lengthCm,
        widthCm: payload.parcel.widthCm,
        heightCm: payload.parcel.heightCm,
      },
      fragilityLevel: payload.parcel.fragilityLevel,
      routeComplexity: payload.coverageStatus === "review" ? "review" : "standard",
    },
    {
      baseFeeMinor: settings.base_price_minor,
      distanceFeePerKmMinor: settings.price_per_km_minor,
    },
  );

  const addresses = new AddressesRepository(supabase);
  const pickupAddress = await addresses.create({
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
  if (!pickupAddress.ok) {
    return NextResponse.json({ error: "Failed to create pickup address." }, { status: 502 });
  }
  const dropoffAddress = await addresses.create({
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
  if (!dropoffAddress.ok) {
    return NextResponse.json({ error: "Failed to create dropoff address." }, { status: 502 });
  }

  const parcel = payload.parcel;
  const hasDimensions =
    parcel.lengthCm !== null && parcel.widthCm !== null && parcel.heightCm !== null;
  const parcels = new ParcelsRepository(supabase);
  const parcelResult = await parcels.create({
    contentsDescription: parcel.contentDescription,
    fragilityLevel: parcel.fragilityLevel,
    packagingType: parcel.packaging,
    approximateSize: parcel.approximateSize,
    declaredWeightKg: parcel.weightKg,
    estimatedWeightRange: parcel.estimatedWeightRange,
    thermalProtection: configuration?.temperatureProtection ?? "none",
    declaredDimensionsCm: hasDimensions
      ? { lengthCm: parcel.lengthCm!, widthCm: parcel.widthCm!, heightCm: parcel.heightCm! }
      : null,
  });
  if (!parcelResult.ok) {
    return NextResponse.json({ error: "Failed to create parcel." }, { status: 502 });
  }

  const storedPickup = toStoredHandoffPoint(payload.selectedPickupPoint);
  const storedDropoff = toStoredHandoffPoint(payload.selectedDropoffPoint);
  const handoffPointsSnapshot: HandoffPointsSnapshot | null =
    storedPickup && storedDropoff ? createCompleteHandoffSnapshot(payload) : null;
  const orderResult = await orders.create({
    localOrderId: body.localOrderId,
    publicTrackingCode: body.publicTrackingCode,
    recipientTrackingToken: body.recipientTrackingToken,
    senderProfileId: profileId,
    pickupAddressId: pickupAddress.data.id,
    dropoffAddressId: dropoffAddress.data.id,
    parcelId: parcelResult.data.id,
    status: "pending",
    fulfillmentStatus: "order_created",
    dispatchTiming: payload.urgency as DispatchTiming,
    scheduledAt: payload.scheduledAt,
    droneClass: payload.recommendedDroneClass,
    deliveryConfigurationId: configuration?.id ?? "default",
    etaMinMinutes: payload.estimatedEta?.minMinutes ?? null,
    etaMaxMinutes: payload.estimatedEta?.maxMinutes ?? null,
    totalAmountMinor: pricing.total.amountMinor,
    currency: pricing.currency,
    pricingSnapshot: pricingSnapshotFromResult(pricing),
    handoffPointsSnapshot,
    selectedPickupHandoffPoint: storedPickup,
    selectedDropoffHandoffPoint: storedDropoff,
    paymentStatus: "pending",
    stripePaymentIntentId: null,
  });
  if (!orderResult.ok) {
    return NextResponse.json({ error: "Failed to create order." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    supabaseOrderId: orderResult.data.id,
    localOrderId: orderResult.data.localOrderId,
    publicTrackingCode: orderResult.data.publicTrackingCode,
    recipientTrackingToken: orderResult.data.recipientTrackingToken,
    totalAmountMinor: orderResult.data.totalAmountMinor,
    currency: orderResult.data.currency,
  });
}
