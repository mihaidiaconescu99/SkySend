export type AssistantLanguage = "ro" | "en";

export type AssistantKnowledgeKind = "faq" | "guide" | "policy";

export type AssistantKnowledgeRecord = {
  id: string;
  kind: AssistantKnowledgeKind;
  category: string;
  title: string;
  aliases: string[];
  keywords: string[];
  body: string;
  href?: string;
  source: string;
};

export type AssistantHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantOrderContext = {
  localOrderId: string;
  status: string;
  fulfillmentStatus: string | null;
  deliveryType: string;
  scheduledAt: string | null;
  etaMinMinutes: number | null;
  etaMaxMinutes: number | null;
  amountMinor: number;
  currency: string;
  paymentStatus: string;
  refundStatus: string | null;
  updatedAt: string;
  detailHref: string;
};

export type AssistantRuntimeContext = {
  operational: {
    platformStatus: string;
    city: string;
    county: string;
    country: string;
    radiusKm: number;
    basePriceMinor: number;
    pricePerKmMinor: number;
    currency: string;
    timers: {
      meetingPointConfirmationMinutes: number;
      parcelLoadMinutes: number;
      parcelUnloadMinutes: number;
    };
  };
  account: {
    authenticated: boolean;
    orders: AssistantOrderContext[];
    selectedOrder?: AssistantOrderContext;
  };
};

