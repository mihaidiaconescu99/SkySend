import { describe, expect, it } from "vitest";
import { retrieveAssistantKnowledge } from "@/lib/ai/skysend-assistant-knowledge";

describe("retrieveAssistantKnowledge", () => {
  it("retrieves coverage guidance for an address question", () => {
    const chunks = retrieveAssistantKnowledge(
      "Este adresa mea în zona de acoperire din Pitești?",
    );

    expect(chunks.map((chunk) => chunk.id)).toContain("coverage");
  });

  it("retrieves parcel guidance for a delivery suitability question", () => {
    const chunks = retrieveAssistantKnowledge(
      "Pot trimite un colet fragil cu drona?",
    );

    expect(chunks.map((chunk) => chunk.id)).toContain("parcel");
  });

  it("does not return unrelated chunks for an empty query", () => {
    expect(retrieveAssistantKnowledge("")).toEqual([]);
  });
});
