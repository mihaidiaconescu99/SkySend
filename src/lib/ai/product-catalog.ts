import "server-only";

import { serverEnv } from "@/lib/env.server";
import type { ParcelDetectedItem, ProductLookupResult } from "@/types/parcel-intelligence";

const timeoutMs = 2_500;
const gtinPattern = /^\d{8,14}$/;

function productId(item: ParcelDetectedItem) {
  const candidate = item.productIdentifier?.replace(/\s/g, "") ?? "";
  return gtinPattern.test(candidate) ? candidate : null;
}

async function getJson(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response.ok ? await response.json() as Record<string, unknown> : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

async function lookupOpenFoodFacts(gtin: string): Promise<ProductLookupResult | null> {
  const payload = await getJson(
    `https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(gtin)}?fields=product_name,brands,categories,quantity,packagings`,
    { headers: { "User-Agent": serverEnv.OPEN_FOOD_FACTS_USER_AGENT } },
  );
  const product = payload?.product as Record<string, unknown> | undefined;
  const title = typeof product?.product_name === "string" ? product.product_name.trim() : "";
  if (!title) return null;
  const details = [product?.brands, product?.categories, product?.quantity].filter((value): value is string => typeof value === "string" && Boolean(value)).join(" · ");
  return { title, url: `https://world.openfoodfacts.org/product/${gtin}`, snippet: details || "Open Food Facts exact GTIN match", sourceType: "catalog", confidence: 0.95 };
}

async function lookupIcecat(gtin: string): Promise<ProductLookupResult | null> {
  if (!serverEnv.ICECAT_USERNAME || !serverEnv.ICECAT_PASSWORD) return null;
  const url = new URL("https://live.icecat.biz/api/");
  url.searchParams.set("UserName", serverEnv.ICECAT_USERNAME);
  url.searchParams.set("Language", "en");
  url.searchParams.set("GTIN", gtin);
  const payload = await getJson(url.toString(), { headers: { Authorization: `Basic ${Buffer.from(`${serverEnv.ICECAT_USERNAME}:${serverEnv.ICECAT_PASSWORD}`).toString("base64")}` } });
  const data = (payload?.data ?? payload) as Record<string, unknown>;
  const title = typeof data?.Title === "string" ? data.Title.trim() : typeof data?.title === "string" ? data.title.trim() : "";
  if (!title) return null;
  const details = [data?.Brand, data?.ProductCode, data?.Weight, data?.Width, data?.Height, data?.Depth].filter((value) => typeof value === "string" || typeof value === "number").join(" · ");
  return { title, url: "https://icecat.com/", snippet: String(details || "Open Icecat exact GTIN match"), sourceType: "catalog", confidence: 0.95 };
}

export async function lookupExactCatalogProducts(items: ParcelDetectedItem[]) {
  const gtins = Array.from(new Set(items.map(productId).filter((value): value is string => Boolean(value)))).slice(0, 2);
  const results = await Promise.all(gtins.flatMap((gtin) => [lookupOpenFoodFacts(gtin), lookupIcecat(gtin)]));
  return results.filter((result): result is ProductLookupResult => Boolean(result));
}
