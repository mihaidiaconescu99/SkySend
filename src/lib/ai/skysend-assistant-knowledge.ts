import generatedKnowledge from "@/generated/assistant-knowledge.json";
import type { AssistantKnowledgeRecord } from "@/types/assistant";

const index = generatedKnowledge as {
  version: number;
  sources: string[];
  records: AssistantKnowledgeRecord[];
};

export const assistantKnowledge = index.records as readonly AssistantKnowledgeRecord[];
export const assistantFaq = assistantKnowledge.filter((record) => record.kind === "faq");

const synonymGroups = [
  ["plata", "plati", "payment", "pay", "card", "stripe", "checkout"],
  ["rambursare", "rambursari", "refund", "refunds", "returnare bani"],
  ["comanda", "comenzi", "order", "orders", "livrare", "delivery"],
  ["colet", "pachet", "parcel", "package"],
  ["punct", "intalnire", "handoff", "meeting", "pickup", "dropoff"],
  ["locker", "compartiment", "cutie"],
  ["pin", "cod", "code"],
  ["urmarire", "tracking", "status", "stare", "eta"],
  ["anulare", "anulez", "cancel", "cancellation"],
  ["factura", "invoice", "receipt", "chitanta"],
  ["greutate", "weight", "dimensiuni", "dimensions", "volum", "volume"],
  ["imagine", "imagini", "poza", "poze", "image", "photo"],
  ["agent", "operator", "uman", "human", "support", "suport"],
] as const;

const stopWords = new Set([
  "a", "ai", "am", "are", "as", "can", "care", "ce", "cu", "cum", "de", "do", "este",
  "fi", "how", "i", "in", "is", "la", "me", "mea", "meu", "my", "o", "pot", "sa",
  "sunt", "the", "un", "una", "what", "with",
]);

export function normalizeAssistantText(value: string) {
  return value
    .toLocaleLowerCase("ro-RO")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function terms(value: string) {
  const normalizedValue = normalizeAssistantText(value);
  const tokens = new Set(
    normalizedValue
      .split(" ")
      .filter((term) => term.length >= 2 && !stopWords.has(term)),
  );

  for (const group of synonymGroups) {
    const normalizedGroup = group.map(normalizeAssistantText);
    if (normalizedGroup.some((term) => term.includes(" ") ? normalizedValue.includes(term) : tokens.has(term))) {
      normalizedGroup.forEach((term) => term.split(" ").forEach((token) => tokens.add(token)));
    }
  }
  return tokens;
}

function rawTerms(value: string) {
  return new Set(
    normalizeAssistantText(value)
      .split(" ")
      .filter((term) => term.length >= 2 && !stopWords.has(term)),
  );
}

function overlap(queryTerms: Set<string>, value: string, weight: number) {
  const valueTerms = rawTerms(value);
  return [...queryTerms].reduce(
    (score, term) => score + (valueTerms.has(term) ? weight : 0),
    0,
  );
}

export type AssistantKnowledgeMatch = {
  record: AssistantKnowledgeRecord;
  score: number;
  exact: boolean;
};

export function scoreAssistantKnowledge(query: string): AssistantKnowledgeMatch[] {
  const normalizedQuery = normalizeAssistantText(query);
  const queryTerms = terms(query);

  return assistantKnowledge
    .map((record) => {
      const exact = [record.title, ...record.aliases]
        .map(normalizeAssistantText)
        .some((candidate) => candidate === normalizedQuery || (candidate.length >= 8 && normalizedQuery.includes(candidate)));
      const score =
        (exact ? 100 : 0) +
        overlap(queryTerms, record.title, 12) +
        overlap(queryTerms, record.aliases.join(" "), 10) +
        overlap(queryTerms, record.keywords.join(" "), 7) +
        overlap(queryTerms, record.category, 4) +
        overlap(queryTerms, record.body, 1) +
        (record.kind === "policy" ? 1 : 0);
      return { record, score, exact };
    })
    .filter((match) => match.score >= 4)
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id));
}

export function retrieveAssistantKnowledge(query: string, limit = 6) {
  return scoreAssistantKnowledge(query)
    .slice(0, Math.max(0, limit))
    .map((match) => match.record);
}

export function findStrongFaqMatch(query: string) {
  const match = scoreAssistantKnowledge(query).find((item) => item.record.kind === "faq");
  return match && (match.exact || match.score >= 34) ? match.record : null;
}
