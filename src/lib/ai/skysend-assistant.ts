import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createGeoapifyForwardGeocodingUrl } from "@/lib/geoapify";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { isGeocodedAddressEligible } from "@/lib/service-area";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { retrieveAssistantKnowledge } from "@/lib/ai/skysend-assistant-knowledge";
import type { GeocodedAddress } from "@/types/service-area";

export type AssistantAction = {
  label: string;
  href: string;
};

export type AssistantReply = {
  message: string;
  action?: AssistantAction;
  sourceIds?: string[];
  handoffOffer?: boolean;
};

type AssistantLanguage = "ro" | "en";

type GeoapifySearchResponse = {
  results?: Array<{
    formatted?: string;
    lat?: number;
    lon?: number;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  }>;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function replyLanguage(language: string | undefined): AssistantLanguage {
  return language === "en" ? "en" : "ro";
}

function normalized(value: string) {
  return value
    .toLocaleLowerCase("ro-RO")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function hasAny(value: string, candidates: string[]) {
  return candidates.some((candidate) => value.includes(candidate));
}

function action(label: string, href: string): AssistantReply["action"] {
  return { label, href };
}

function fallbackReply(language: AssistantLanguage): AssistantReply {
  if (language === "en") {
    return {
      message:
        "I can help with delivery flow, coverage, parcels, lockers, tracking, payments and dashboard use. Tell me what you want to do and I will guide you to the right SkySend step.",
      action: action("See FAQ", "/faq"),
    };
  }

  return {
    message:
      "Te pot ajuta cu procesul de livrare, acoperirea, coletele, lockerele, trackingul, platile si folosirea dashboard-ului. Spune-mi ce vrei sa faci, iar eu te ghidez catre functia SkySend potrivita.",
    action: action("Vezi intrebarile frecvente", "/faq"),
  };
}

function wantsHumanSupport(query: string) {
  return hasAny(query, [
    "asistenta umana",
    "suport uman",
    "operator",
    "agent",
    "persoana reala",
    "vreau sa vorbesc cu cineva",
    "human support",
    "talk to a human",
    "speak to an operator",
    "real person",
  ]);
}

function shouldOfferHumanSupport(query: string) {
  return hasAny(query, [
    "reclamatie",
    "plangere",
    "problema grava",
    "blocata",
    "blocat",
    "nu pot continua",
    "plata esuata",
    "locker blocat",
    "recuperare",
    "refund",
    "complaint",
    "stuck",
    "failed payment",
    "cannot continue",
  ]);
}

function humanSupportReply(language: AssistantLanguage): AssistantReply {
  return language === "en"
    ? {
        message:
          "I can ask a SkySend operator to continue this conversation. I will only create the ticket after you confirm, so the operator can see the conversation history.",
        handoffOffer: true,
      }
    : {
        message:
          "Pot cere unui operator SkySend sa continue aceasta conversatie. Creez tichetul doar dupa confirmarea ta, ca operatorul sa vada istoricul conversatiei.",
        handoffOffer: true,
      };
}

function extractAddress(message: string) {
  return message
    .replace(/^(este|e|verifica|poti verifica)?\s*(adresa|locatia)?\s*(mea|asta)?\s*(in)?\s*(zona|acoperita)?\s*(de\s+livrare)?\s*/iu, "")
    .replace(/\?+$/u, "")
    .trim();
}

async function checkCoverage(
  message: string,
  language: AssistantLanguage,
): Promise<AssistantReply> {
  const addressQuery = extractAddress(message);
  const labels =
    language === "en"
      ? {
          needAddress:
            "Send the full address, including street, number and city, and I can check whether it is inside the active SkySend area. For final handoff selection, continue in the delivery creation flow.",
          activeArea: "See active area",
          unavailable:
            "Automatic address checking is unavailable right now. You can enter the address in the delivery creation flow, where SkySend applies the full validation.",
          create: "Create delivery",
          imprecise:
            "I could not identify the address precisely enough. Include street, number and city, or check it directly in the delivery creation flow.",
          continue: "Continue with address",
          failed:
            "Automatic address checking did not respond. You can enter the address in the delivery creation flow for full validation.",
        }
      : {
          needAddress:
            "Trimite-mi adresa completa, cu strada, numar si localitate, iar eu pot verifica daca se afla in zona activa SkySend. Pentru alegerea finala a punctului de handoff, continua apoi in fluxul de creare a livrarii.",
          activeArea: "Vezi zona activa",
          unavailable:
            "Verificarea automata a adresei nu este disponibila acum. Poti introduce adresa in fluxul de creare a livrarii, unde SkySend aplica validarea completa.",
          create: "Creeaza livrare",
          imprecise:
            "Nu am putut identifica adresa cu suficienta precizie. Include strada, numarul si localitatea sau verifica direct in fluxul de creare a livrarii.",
          continue: "Continua cu adresa",
          failed:
            "Verificarea automata a adresei nu a raspuns. Poti introduce adresa in fluxul de creare a livrarii pentru validarea completa.",
        };

  if (addressQuery.length < 6) {
    return {
      message: labels.needAddress,
      action: action(labels.activeArea, "/#coverage"),
    };
  }

  const url = createGeoapifyForwardGeocodingUrl(addressQuery);
  if (!url) {
    return {
      message: labels.unavailable,
      action: action(labels.create, "/client/create-delivery"),
    };
  }

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const data = (await response.json()) as GeoapifySearchResponse;
    const result = data.results?.[0];

    if (
      !response.ok ||
      !result?.formatted ||
      result.lat === undefined ||
      result.lon === undefined
    ) {
      return {
        message: labels.imprecise,
        action: action(labels.create, "/client/create-delivery"),
      };
    }

    const address: GeocodedAddress = {
      formattedAddress: result.formatted,
      location: { latitude: result.lat, longitude: result.lon },
      city: result.city ?? null,
      county: result.county ?? result.state ?? null,
      country: result.country ?? null,
      postalCode: result.postcode ?? null,
    };
    const eligibility = isGeocodedAddressEligible(address);

    return {
      message: eligibility.isEligible
        ? `${address.formattedAddress}: ${eligibility.message}${eligibility.needsManualReview ? " Adresa este aproape de limita si va fi verificata din nou inainte de lansare." : ""}`
        : `${address.formattedAddress}: ${eligibility.message} Pentru confirmarea finala, verifica adresa si punctele de handoff in fluxul de creare a livrarii.`,
      action: action(labels.continue, "/client/create-delivery"),
      sourceIds: ["coverage"],
    };
  } catch {
    return {
      message: labels.failed,
      action: action(labels.create, "/client/create-delivery"),
    };
  }
}

function formatStoredOrderStatus(status: string, language: AssistantLanguage) {
  const ro: Record<string, string> = {
    pending: "in asteptare",
    in_progress: "in desfasurare",
    completed: "livrare finalizata",
    failed: "necesita suport",
    cancelled: "anulata",
  };
  const en: Record<string, string> = {
    pending: "pending",
    in_progress: "in progress",
    completed: "completed",
    failed: "requiring support",
    cancelled: "cancelled",
  };
  return (language === "en" ? en : ro)[status] ?? (language === "en" ? "under review" : "in curs de verificare");
}

async function checkOrderStatus(
  orderId: string,
  language: AssistantLanguage,
): Promise<AssistantReply> {
  const { userId } = await auth();
  const labels =
    language === "en"
      ? {
          signIn:
            "To check an order from your account, sign in first. If you are the recipient, use the public tracking code or link you received.",
          signInAction: "Sign in",
          profile:
            "Your SkySend profile is not available for order checks yet. Open the client dashboard or try again after reloading.",
          dashboard: "Open dashboard",
          unavailable:
            "I could not load this order right now. You can see the current list and details in Orders.",
          orders: "Open Orders",
          missing:
            "I did not find an order from your account with this identifier. Check the identifier or open Orders. For a received delivery, use public tracking.",
          detail: "See order details",
          status: "is",
          detailHint:
            "Open the details for the timeline, tracking and next steps.",
        }
      : {
          signIn:
            "Pentru a verifica o comanda din contul tau, autentifica-te mai intai. Daca esti destinatar, foloseste codul sau linkul public de tracking primit.",
          signInAction: "Autentificare",
          profile:
            "Profilul SkySend nu este inca disponibil pentru verificarea comenzilor. Deschide dashboard-ul client sau incearca din nou dupa reincarcare.",
          dashboard: "Deschide dashboard-ul",
          unavailable:
            "Nu am putut incarca aceasta comanda acum. Poti vedea lista si detaliile actualizate in pagina Comenzi.",
          orders: "Deschide Comenzi",
          missing:
            "Nu am gasit o comanda din contul tau cu acest identificator. Verifica identificatorul sau deschide lista comenzilor. Pentru o livrare primita, foloseste trackingul public.",
          detail: "Vezi detaliile comenzii",
          status: "este",
          detailHint:
            "Poti deschide detaliile pentru timeline, tracking si urmatorii pasi.",
        };

  if (!userId) {
    return {
      message: labels.signIn,
      action: action(labels.signInAction, "/sign-in"),
    };
  }

  const supabase = createAdminSupabaseClient();
  const profiles = new ProfilesRepository(supabase);
  const orders = new OrdersRepository(supabase);
  const profile = await profiles.getByClerkUserId(userId);
  if (!profile.ok || !profile.data) {
    return {
      message: labels.profile,
      action: action(labels.dashboard, "/client"),
    };
  }

  let order = await orders.getByLocalOrderId(orderId);
  if (order.ok && !order.data) order = await orders.getById(orderId);

  if (!order.ok) {
    return {
      message: labels.unavailable,
      action: action(labels.orders, "/client/orders"),
    };
  }

  if (!order.data || order.data.senderProfileId !== profile.data.id) {
    return {
      message: labels.missing,
      action: action(labels.orders, "/client/orders"),
    };
  }

  const href = `/client/orders/${encodeURIComponent(order.data.localOrderId)}`;
  return {
    message: `Order ${order.data.localOrderId} ${labels.status} ${formatStoredOrderStatus(order.data.status, language)}. ${labels.detailHint}`,
    action: action(labels.detail, href),
    sourceIds: ["tracking"],
  };
}

async function generateGroundedReply(
  message: string,
  language: AssistantLanguage,
): Promise<AssistantReply | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  const knowledge = retrieveAssistantKnowledge(message);
  if (!knowledge.length) return null;

  const systemInstruction =
    language === "en"
      ? "You are the native SkySend assistant. Reply only in English, concisely, calmly and helpfully. Use only the provided context. Do not invent rules, prices, time estimates, routes, payment actions or operational confirmations. Do not ask for card data, passwords, tokens or unnecessary personal data. If a human operator is needed, ask whether the user agrees to turn the conversation into a support ticket."
      : "Esti asistentul nativ SkySend. Raspunzi numai in romana, concis, calm si util. Foloseste exclusiv contextul primit. Nu inventa reguli, preturi, estimari de timp, rute, actiuni de plata sau confirmari operationale. Nu cere date de card, parole, tokenuri sau date personale inutile. Daca este nevoie de operator uman, intreaba utilizatorul daca este de acord sa transforme conversatia in tichet.";

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL?.trim() || "http://localhost:3000",
      "X-OpenRouter-Title": process.env.OPENROUTER_APP_NAME?.trim() || "SkySend",
    },
    body: JSON.stringify({
      model:
        process.env.OPENROUTER_ASSISTANT_MODEL?.trim() ||
        process.env.OPENROUTER_MODEL?.trim() ||
        "openrouter/free",
      temperature: 0.2,
      max_tokens: 420,
      messages: [
        { role: "system", content: systemInstruction },
        {
          role: "user",
          content: `Question: ${message}\n\nSkySend context:\n${knowledge.map((item) => `- ${item.title}: ${item.text}`).join("\n")}`,
        },
      ],
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return null;

  const primaryChunk = knowledge.find((item) => item.href);
  return {
    message: content.slice(0, 1800),
    action: primaryChunk?.href
      ? action(
          language === "en" ? `Open ${primaryChunk.title}` : `Deschide ${primaryChunk.title}`,
          primaryChunk.href === "/coverage" ? "/#coverage" : primaryChunk.href,
        )
      : undefined,
    sourceIds: knowledge.map((item) => item.id),
  };
}

export async function getSkySendAssistantReply(
  rawMessage: string,
  rawLanguage = "ro",
): Promise<AssistantReply> {
  const language = replyLanguage(rawLanguage);
  const message = rawMessage.trim().slice(0, 700);
  const query = normalized(message);

  if (!message) return fallbackReply(language);
  if (wantsHumanSupport(query)) return humanSupportReply(language);

  if (
    hasAny(query, [
      "cum functioneaza",
      "cum merge skysend",
      "procesul de livrare",
      "placing an order",
      "how does skysend work",
    ])
  ) {
    return language === "en"
      ? {
          message:
            "After signing in, you choose pickup and delivery addresses, confirm handoff points, describe the parcel, choose the delivery type, review the estimate and finish securely in checkout. Then you can track the order from the dashboard or public tracking.",
          action: action("See how it works", "/how-it-works"),
          sourceIds: ["delivery-flow"],
        }
      : {
          message:
            "Dupa autentificare, alegi adresele si punctele de handoff, confirmi profilul coletului, alegi tipul de livrare, verifici estimarea si finalizezi securizat in checkout. Apoi poti urmari comanda din dashboard sau prin tracking.",
          action: action("Vezi cum functioneaza", "/how-it-works"),
          sourceIds: ["delivery-flow"],
        };
  }

  if (hasAny(query, ["pret", "cost", "tarif", "cat costa", "price", "pricing"])) {
    return {
      message:
        language === "en"
          ? "I cannot calculate the exact price in chat because SkySend uses addresses, handoff points, parcel profile and selected configuration. Create a delivery to see the right estimate."
          : "Nu pot calcula corect pretul in chat, deoarece SkySend foloseste adresele, punctele de handoff, coletul si configuratia aleasa. Creeaza o livrare pentru a vedea estimarea potrivita.",
      action: action(language === "en" ? "Create delivery" : "Creeaza livrare", "/client/create-delivery"),
    };
  }

  if (hasAny(query, ["cat dureaza", "durata", "cand ajunge", "eta", "how long", "when arrives"])) {
    return {
      message:
        language === "en"
          ? "For an accurate ETA, create a delivery or open the existing order. SkySend calculates timing from addresses, handoff points and the real parcel configuration."
          : "Pentru un timp estimat corect, creeaza o livrare sau deschide comanda existenta. SkySend calculeaza estimarea folosind adresele, punctele de handoff si configuratia reala a coletului.",
      action: action(language === "en" ? "Create delivery" : "Creeaza livrare", "/client/create-delivery"),
    };
  }

  if (hasAny(query, ["plata", "card", "checkout", "achita", "payment", "pay"])) {
    return {
      message:
        language === "en"
          ? "Payments are completed securely through Stripe checkout. Chat cannot process payment, but you can continue from the order page or your payment methods."
          : "Platile sunt finalizate securizat prin checkout-ul Stripe. Chatul nu poate procesa o plata, dar poti continua din pagina comenzii sau din metodele tale de plata.",
      action: action(language === "en" ? "See payment methods" : "Vezi metodele de plata", "/client/payment-methods"),
    };
  }

  if (hasAny(query, ["creeaza livrare", "trimite colet", "fa o livrare", "create delivery", "send parcel"])) {
    return {
      message:
        language === "en"
          ? "I cannot create a delivery directly from chat, but I can guide you. Open Create delivery for addresses, handoff points, parcel evaluation, estimate and checkout."
          : "Nu pot crea o livrare direct din chat, dar te pot ghida prin pasi. Deschide Creeaza livrare pentru adrese, puncte de handoff, evaluarea coletului, estimare si checkout.",
      action: action(language === "en" ? "Create delivery" : "Creeaza livrare", "/client/create-delivery"),
    };
  }

  if (
    hasAny(query, ["colet", "pachet", "fragil", "greutate", "dimensiuni", "parcel", "package", "fragile"]) &&
    hasAny(query, ["poate", "pot", "eligibil", "livrat", "trimite", "eligible", "send"])
  ) {
    return {
      message:
        language === "en"
          ? "Parcel eligibility can be checked only after you confirm description, packaging, weight, dimensions and fragility. SkySend compares those details with available configurations and may ask clarifying questions."
          : "Eligibilitatea coletului poate fi verificata doar dupa ce confirmi descrierea, ambalarea, greutatea, dimensiunile si fragilitatea. SkySend compara aceste date cu configuratiile disponibile si poate cere clarificari.",
      action: action(language === "en" ? "Evaluate parcel" : "Evalueaza coletul", "/client/create-delivery"),
      sourceIds: ["parcel"],
    };
  }

  const orderId = message.match(/(?:SKY-[A-Z]{2}-\d{5}-\d{3}|[0-9a-f]{8}-[0-9a-f-]{27,})/iu)?.[0];
  if (orderId && hasAny(query, ["status", "stare", "comanda", "unde", "tracking", "order"])) {
    return checkOrderStatus(orderId, language);
  }

  if (hasAny(query, ["acoperire", "adresa", "zona", "livrati in", "coverage", "address", "area"])) {
    return checkCoverage(message, language);
  }

  try {
    const grounded = await generateGroundedReply(message, language);
    if (grounded) {
      return shouldOfferHumanSupport(query)
        ? { ...grounded, handoffOffer: true }
        : grounded;
    }

    return shouldOfferHumanSupport(query)
      ? humanSupportReply(language)
      : fallbackReply(language);
  } catch {
    return {
      message:
        language === "en"
          ? "The assistant cannot generate a detailed answer right now. You can check the FAQ or continue in the delivery flow."
          : "Asistentul nu poate genera un raspuns detaliat chiar acum. Poti consulta intrebarile frecvente sau continua in fluxul de livrare.",
      action: action(language === "en" ? "See FAQ" : "Vezi intrebarile frecvente", "/faq"),
    };
  }
}
