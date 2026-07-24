export class UpstreamTimeoutError extends Error {
  constructor() {
    super("upstream_timeout");
    this.name = "UpstreamTimeoutError";
  }
}

export class UpstreamBodyTooLargeError extends Error {
  constructor() {
    super("upstream_response_too_large");
    this.name = "UpstreamBodyTooLargeError";
  }
}

export async function fetchWithTimeout(
  input: string | URL | Request,
  init: RequestInit = {},
  options: {
    timeoutMs: number;
    fetchImpl?: typeof fetch;
  },
) {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
  }
  const timeout = setTimeout(
    () => controller.abort(new UpstreamTimeoutError()),
    options.timeoutMs,
  );

  try {
    return await (options.fetchImpl ?? fetch)(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (
      controller.signal.aborted &&
      !externalSignal?.aborted
    ) {
      throw new UpstreamTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

export async function readLimitedResponseBytes(
  response: Response,
  maxBytes: number,
) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && /^\d+$/u.test(declaredLength)) {
    const parsed = Number(declaredLength);
    if (!Number.isSafeInteger(parsed) || parsed > maxBytes) {
      throw new UpstreamBodyTooLargeError();
    }
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new UpstreamBodyTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readLimitedJsonResponse<T>(
  response: Response,
  maxBytes: number,
): Promise<T> {
  const bytes = await readLimitedResponseBytes(response, maxBytes);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return JSON.parse(text) as T;
}
