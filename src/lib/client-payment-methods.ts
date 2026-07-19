import { getMockPaymentMethods, getMockUserProfile } from "@/lib/mock-data";
import { stripeTestCards } from "@/constants/stripe-test-cards";
import type { ClientSavedTestCard } from "@/types/payment-methods";

function formatExpiryLabel(value?: string | null) {
  if (!value) {
    return "Card on file";
  }

  const [year, month] = value.split("-");

  if (!year || !month) {
    return value;
  }

  return `${month}/${year.slice(-2)}`;
}

export function getClientSavedTestCards(): ClientSavedTestCard[] {
  const userProfile = getMockUserProfile();
  const mockCards = getMockPaymentMethods()
    .filter((method) => method.type === "card")
    .map((method) => ({
      id: method.id,
      userProfileId: method.userProfileId,
      label: method.label,
      brand: method.brand ?? "Card",
      last4: method.last4 ?? "0000",
      expiryLabel: formatExpiryLabel(method.expiresAt),
      isDefault: method.isDefault,
      status: "active" as const,
      providerReference: method.providerReference,
      createdAt: method.createdAt,
      updatedAt: method.updatedAt,
    }));

  const defaultCard = stripeTestCards[0];

  return [
    ...mockCards,
    {
      id: `pm_card_${defaultCard.id}`,
      userProfileId: userProfile.id,
      label: defaultCard.label,
      brand: defaultCard.brand,
      last4: defaultCard.last4,
      expiryLabel: defaultCard.expiryLabel,
      isDefault: mockCards.length === 0,
      status: "test_ready",
      providerReference: `pm_card_${defaultCard.last4}`,
      createdAt: "2026-04-24T09:00:00.000Z",
      updatedAt: "2026-04-24T09:00:00.000Z",
    },
  ];
}
