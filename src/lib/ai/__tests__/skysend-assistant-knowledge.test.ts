import { describe, expect, it } from "vitest";
import {
  assistantFaq,
  assistantKnowledge,
  findStrongFaqMatch,
  retrieveAssistantKnowledge,
} from "@/lib/ai/skysend-assistant-knowledge";

describe("assistant knowledge index", () => {
  it("contains unique records and every required FAQ category", () => {
    expect(assistantFaq.length).toBeGreaterThanOrEqual(50);
    expect(new Set(assistantKnowledge.map((item) => item.id)).size).toBe(assistantKnowledge.length);
    expect(new Set(assistantFaq.map((item) => item.category))).toEqual(new Set([
      "general", "delivery", "handoff", "meeting-points", "parcels", "payments",
      "security", "tracking", "cancellations", "technical", "account", "support",
      "assistant-limits",
    ]));
    expect(assistantKnowledge.every((item) => item.body.trim() && (!item.href || item.href.startsWith("/")))).toBe(true);
  });

  it("contains the fixed commercial policy facts", () => {
    const policies = assistantKnowledge.filter((item) => item.kind === "policy").map((item) => item.body).join(" ");
    expect(policies).toContain("2.000 EUR");
    expect(policies).toContain("14 zile");
    expect(policies).toContain("7–8 secunde");
    expect(policies).toContain("Apple Pay");
    expect(policies).toContain("Google Pay");
    expect(policies).toContain("numerar");
  });
});

describe("retrieveAssistantKnowledge", () => {
  it("normalizes Romanian diacritics for coverage", () => {
    const chunks = retrieveAssistantKnowledge("Este adresa mea in zona de acoperire din Pitesti?");
    expect(chunks[0]?.id).toBe("kb.delivery.addresses");
  });

  it.each([
    ["Can I pay cash or by card?", "payments"],
    ["Cum aleg cele patru meeting points?", "meeting-points"],
    ["PIN-ul lockerului nu merge", "handoff"],
    ["Ce greutate si dimensiuni poate avea coletul?", "parcels"],
    ["How do I cancel and get a refund?", "cancellations"],
  ])("retrieves a relevant category for %s", (question, category) => {
    expect(retrieveAssistantKnowledge(question).some((item) => item.category === category)).toBe(true);
  });

  it("returns the complete editorial answer for a strong FAQ match", () => {
    const match = findStrongFaqMatch("Pot plăti cash?");
    expect(match?.kind).toBe("faq");
    expect(match?.body.toLocaleLowerCase("ro-RO")).toContain("cash nu este disponibilă");
  });

  it("does not return unrelated chunks for an empty query", () => {
    expect(retrieveAssistantKnowledge("")).toEqual([]);
  });
});
