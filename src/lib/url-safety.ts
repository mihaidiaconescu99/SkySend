const internalPathPattern = /^\/(?!\/)[A-Za-z0-9/_?&=.%+#-]*$/u;

export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 500) return null;
  return internalPathPattern.test(normalized) ? normalized : null;
}

export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
