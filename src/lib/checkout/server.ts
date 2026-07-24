import "server-only";

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import { deliveryConfigurations } from "@/constants/delivery-configurations";
import { calculateDistanceKm } from "@/lib/mission-route";
import { calculateSkySendPricing } from "@/lib/pricing";
import { createCompleteHandoffSnapshot } from "@/lib/meeting-point-snapshot";
import type {
  BillingSnapshotInput,
  DeliveryCheckoutSession,
  SavedBillingProfile,
} from "@/types/billing";
import type { CreateDeliveryPayload } from "@/types/create-delivery";
import type { PricingSnapshot, PricingSurcharge, StoredHandoffPoint } from "@/types/order";
import type { SkySendPricingResult } from "@/types/pricing";
import type { Database } from "@/types/database";

const database = (supabase: SupabaseClient<Database>) => supabase as any;

type TrustedCheckoutDeliveryPayload = Omit<
  CreateDeliveryPayload,
  "estimatedPrice" | "pricingSnapshot"
>;

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
  return values.filter(([, amount]) => amount !== 0)
    .map(([type, amount, label]) => ({ type, amount, label }));
}

export function toOrderPricingSnapshot(pricing: SkySendPricingResult): PricingSnapshot {
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

function toStoredPoint(point: CreateDeliveryPayload["selectedPickupPoint"]): StoredHandoffPoint {
  return {
    id: point.id,
    label: point.label,
    location: point.location,
    type: point.type,
    reason: point.description,
    smartScore: point.smartScore,
    distanceFromOriginMeters: point.distanceFromOriginMeters,
    recommendationState: point.recommendationState,
    eligibility: { state: point.eligibilityState, message: point.description },
  };
}

export async function priceCheckoutPayload(
  supabase: SupabaseClient<Database>,
  payload: TrustedCheckoutDeliveryPayload,
) {
  const { data: settings, error } = await database(supabase)
    .from("operational_settings")
    .select("base_price_minor,price_per_km_minor,hub_latitude,hub_longitude")
    .limit(1)
    .single();
  if (error || !settings) throw new Error("operational_pricing_unavailable");
  const pickup = payload.selectedPickupPoint?.location;
  const dropoff = payload.selectedDropoffPoint?.location;
  if (!pickup || !dropoff) throw new Error("delivery_points_required");
  const configuration = deliveryConfigurations.find(
    (candidate) => candidate.id === payload.selectedDeliveryConfiguration?.id,
  );
  const distanceKm = calculateDistanceKm(
    { latitude: settings.hub_latitude, longitude: settings.hub_longitude },
    pickup,
  ) + calculateDistanceKm(pickup, dropoff);
  const pricing = calculateSkySendPricing({
    pickupCoordinates: pickup,
    dropoffCoordinates: dropoff,
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
  }, {
    baseFeeMinor: settings.base_price_minor,
    distanceFeePerKmMinor: settings.price_per_km_minor,
  });
  return {
    pricing,
    payload: {
      ...payload,
      estimatedPrice: { amountMinor: pricing.total.amountMinor, currency: "RON" as const },
      pricingSnapshot: pricing,
    },
    orderPricingSnapshot: toOrderPricingSnapshot(pricing),
    handoffPointsSnapshot: createCompleteHandoffSnapshot(
      payload as CreateDeliveryPayload,
    ),
    selectedPickupHandoffPoint: toStoredPoint(payload.selectedPickupPoint),
    selectedDropoffHandoffPoint: toStoredPoint(payload.selectedDropoffPoint),
  };
}

function billingProfileFromRow(row: any): SavedBillingProfile | null {
  if (!row) return null;
  return {
    customerType: row.customer_type,
    fullName: row.full_name,
    companyLegalName: row.company_legal_name,
    taxIdentifier: row.tax_identifier,
    addressLine: row.address_line,
    city: row.city,
    region: row.region,
    countryCode: row.country_code,
    postalCode: row.postal_code,
    invoiceEmail: row.invoice_email,
    locale: row.locale,
  };
}

export async function getSavedBillingProfile(
  supabase: SupabaseClient<Database>,
  profileId: string,
) {
  const { data, error } = await database(supabase).from("profile_billing_details")
    .select("*").eq("profile_id", profileId).maybeSingle();
  if (error) throw new Error(error.message);
  return billingProfileFromRow(data);
}

export async function saveBillingProfile(
  supabase: SupabaseClient<Database>,
  profileId: string,
  input: BillingSnapshotInput | SavedBillingProfile,
) {
  const row = {
    profile_id: profileId,
    customer_type: input.customerType,
    full_name: input.customerType === "individual" ? input.fullName?.trim() || null : null,
    company_legal_name: input.customerType === "company" ? input.companyLegalName?.trim() || null : null,
    tax_identifier: input.customerType === "company" ? input.taxIdentifier?.trim() || null : null,
    address_line: input.addressLine.trim(),
    city: input.city.trim(),
    region: input.region.trim(),
    country_code: input.countryCode.toUpperCase(),
    postal_code: input.postalCode?.trim() || null,
    invoice_email: input.invoiceEmail.trim().toLowerCase(),
    locale: input.locale,
  };
  const { data, error } = await database(supabase).from("profile_billing_details")
    .upsert(row, { onConflict: "profile_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return billingProfileFromRow(data)!;
}

export function serializeCheckoutSession(row: any, saved: SavedBillingProfile | null): DeliveryCheckoutSession {
  const billing = row.billing_data
    ? ({ ...row.billing_data, privacyAccepted: Boolean(row.privacy_acknowledged_at) } as BillingSnapshotInput)
    : null;
  return {
    id: row.id,
    deliveryDraftId: row.delivery_draft_id,
    localOrderId: row.local_order_id,
    currentStep: row.current_step,
    status: row.status,
    totalAmountMinor: row.total_amount_minor,
    currency: row.currency,
    locale: row.locale === "en" ? "en" : "ro",
    expiresAt: row.expires_at,
    billing,
    savedBillingProfile: saved,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    selectedPaymentMethodId: row.selected_payment_method_id,
    orderId: row.order?.local_order_id ?? row.order_id,
    dispatchStartsAt: row.dispatch_starts_at,
  };
}

export async function getOwnedCheckoutSession(
  supabase: SupabaseClient<Database>,
  profileId: string,
  sessionId?: string | null,
) {
  let query = database(supabase).from("delivery_checkout_sessions")
    .select("*,order:orders(local_order_id)").eq("profile_id", profileId);
  query = sessionId
    ? query.eq("id", sessionId)
    : query.in("status", ["active", "payment_processing", "finalizing", "finalization_failed"])
      .order("created_at", { ascending: false }).limit(1);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}
