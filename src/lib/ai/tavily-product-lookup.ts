import "server-only";

import { serverEnv } from "@/lib/env.server";
import type {
  ParcelDetectedItem,
  ParcelLookupTrace,
  ProductLookupResult,
} from "@/types/parcel-intelligence";
import type { ParcelEstimatorRequest } from "@/types/parcel-estimator";


const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const REQUEST_TIMEOUT_MS = 2500;
const TOTAL_RESULTS_CAP = 6;
const MAX_QUERIES = 2;
const SNIPPET_MAX_CHARS = 280;
const QUERY_MAX_CHARS = 48;

type TavilySearchResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
};

type TavilySearchResponse = {
  results?: TavilySearchResult[];
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function getNaturalDescriptionText(input: ParcelEstimatorRequest): string {
  const description = input.naturalDescription?.text ?? input.contentDescription ?? "";
  return description.trim();
}

function clampConfidence(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return 0.3;
  }
  return Math.min(1, Math.max(0, numeric));
}

function truncateSnippet(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= SNIPPET_MAX_CHARS) {
    return clean;
  }
  return `${clean.slice(0, SNIPPET_MAX_CHARS - 1)}…`;
}

const BRAND_PATTERNS: ReadonlyArray<{ brand: RegExp; label: string }> = [
  { brand: /iphone\b/, label: "iphone" },
  { brand: /\bmacbook\b/, label: "macbook" },
  { brand: /\bsamsung\b(?:\s*galaxy)?/, label: "samsung" },
  { brand: /\bgalaxy\b/, label: "samsung galaxy" },
  { brand: /\bgoogle\s*pixel\b/, label: "google pixel" },
  { brand: /\bxiaomi\b/, label: "xiaomi" },
  { brand: /\bhuawei\b/, label: "huawei" },
  { brand: /\boneplus\b/, label: "oneplus" },
  { brand: /\basus\b/, label: "asus" },
  { brand: /\blenovo\b/, label: "lenovo" },
  { brand: /\bdell\b/, label: "dell" },
  { brand: /\bhp\b/, label: "hp" },
  { brand: /\bacer\b/, label: "acer" },
  { brand: /\bcanon\b/, label: "canon" },
  { brand: /\bnikon\b/, label: "nikon" },
  { brand: /\bsony\b/, label: "sony" },
  { brand: /\bbose\b/, label: "bose" },
  { brand: /\bdyson\b/, label: "dyson" },
  { brand: /\bchanel\b/, label: "chanel" },
  { brand: /\bdior\b/, label: "dior" },
  { brand: /\bnintendo\b/, label: "nintendo" },
  { brand: /\bplaystation\b/, label: "playstation" },
  { brand: /\bxbox\b/, label: "xbox" },
];

const MODEL_TOKEN_PATTERN =
  /\b(\d{1,2}(?:\s*(?:pro(?:\s*max)?|ultra|plus|mini|lite|air|ti|se)?)|(?:pro(?:\s*max)?|ultra|plus|mini|lite|air|ti|se)|(?:s|a|m|z)\d{1,2}|note\s*\d{1,2}|z\s*(?:flip|fold)|vivobook|ideapad|thinkpad|inspiron|elitebook|no\.?\s*\d+|eos|switch|playstation|series\s*[xs])\b/i;

export function detectProductLookupCandidates(
  description: string,
  detectedItems: ParcelDetectedItem[] = [],
): string[] {
  const text = normalizeText(description);
  if (!text) {
    return [];
  }

  const itemLabels = detectedItems
    .map((item) => normalizeText(item.label))
    .filter(Boolean);
  const haystack = `${text} ${itemLabels.join(" ")}`;

  const queries: string[] = [];

  for (const { brand, label } of BRAND_PATTERNS) {
    const brandMatch = haystack.match(brand);
    if (!brandMatch) {
      continue;
    }

    const brandIndex = haystack.indexOf(brandMatch[0]);
    const window = haystack.slice(brandIndex, brandIndex + 40);
    const modelMatch = window.match(MODEL_TOKEN_PATTERN);

    const brandWord = brandMatch[0].trim();
    const query = modelMatch
      ? `${label} ${modelMatch[0].trim()}`.slice(0, QUERY_MAX_CHARS).trim()
      : brandWord.slice(0, QUERY_MAX_CHARS).trim();

    if (query && !queries.includes(query)) {
      queries.push(query);
    }
    if (queries.length >= MAX_QUERIES) {
      break;
    }
  }

  return queries;
}

function normalizeTavilyResult(raw: TavilySearchResult): ProductLookupResult | null {
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  const snippet = typeof raw.content === "string" ? truncateSnippet(raw.content) : "";

  if (!title || !url || !/^https?:\/\//i.test(url)) {
    return null;
  }

  return {
    title,
    url,
    snippet,
    sourceType: "web",
    confidence: clampConfidence(raw.score),
  };
}

async function lookupOneQuery(
  query: string,
  controller: AbortController,
): Promise<ProductLookupResult[]> {
  const response = await fetch(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serverEnv.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 3,
      topic: "general",
      include_answer: false,
      include_raw_content: false,
    }),
    signal: controller.signal,
  });

  if (!response.ok) {
    return [];
  }

  let payload: TavilySearchResponse;
  try {
    payload = (await response.json()) as TavilySearchResponse;
  } catch {
    return [];
  }

  const rawResults = Array.isArray(payload?.results) ? payload.results : [];
  const seen = new Set<string>();
  const out: ProductLookupResult[] = [];

  for (const raw of rawResults) {
    const normalized = normalizeTavilyResult(raw);
    if (!normalized || seen.has(normalized.url)) {
      continue;
    }
    seen.add(normalized.url);
    out.push(normalized);
    if (out.length >= TOTAL_RESULTS_CAP) {
      break;
    }
  }

  return out;
}

export async function lookupProducts(queries: string[]): Promise<ProductLookupResult[]> {
  if (!queries.length) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const merged: ProductLookupResult[] = [];
  const seen = new Set<string>();

  try {
    for (const query of queries) {
      if (merged.length >= TOTAL_RESULTS_CAP) {
        break;
      }
      let results: ProductLookupResult[] = [];
      try {
        results = await lookupOneQuery(query, controller);
      } catch {
        results = [];
      }
      for (const result of results) {
        if (!seen.has(result.url)) {
          seen.add(result.url);
          merged.push(result);
        }
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return merged.slice(0, TOTAL_RESULTS_CAP);
}

export async function runProductLookupForEstimate(
  input: ParcelEstimatorRequest,
  detectedItems: ParcelDetectedItem[],
): Promise<{ trace: ParcelLookupTrace; results: ProductLookupResult[] }> {
  if (!serverEnv.TAVILY_API_KEY) {
    return {
      trace: {
        queries: [],
        results: [],
        skipped: true,
        reason: "no_api_key",
        usedInPrompt: false,
      },
      results: [],
    };
  }

  const queries = detectProductLookupCandidates(
    getNaturalDescriptionText(input),
    detectedItems,
  );

  if (!queries.length) {
    return {
      trace: {
        queries: [],
        results: [],
        skipped: true,
        reason: "no_query",
        usedInPrompt: false,
      },
      results: [],
    };
  }

  let results: ProductLookupResult[] = [];
  let failureReason: ParcelLookupTrace["reason"] = "request_failed";
  try {
    results = await lookupProducts(queries);
    if (results.length > 0) {
      failureReason = null;
    }
  } catch {
    failureReason = "request_failed";
    results = [];
  }

  return {
    trace: {
      queries,
      results,
      skipped: results.length === 0,
      reason: failureReason,
      usedInPrompt: false,
    },
    results,
  };
}
