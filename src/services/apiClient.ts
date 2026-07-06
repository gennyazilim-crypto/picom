export type ApiClientErrorCode =
  | "NETWORK_ERROR"
  | "REQUEST_TIMEOUT"
  | "HTTP_ERROR"
  | "ABORTED"
  | "INVALID_RESPONSE"
  | "SERVER_ERROR";

export type ApiClientError = Readonly<{
  code: ApiClientErrorCode;
  message: string;
  status?: number;
  details?: unknown;
}>;

export type ApiClientResult<T> =
  | Readonly<{ ok: true; data: T; response: Response }>
  | Readonly<{ ok: false; error: ApiClientError }>;

export type ApiClientParseMode = "json" | "text" | "empty";

export type ApiClientRequestOptions = Omit<RequestInit, "signal"> & Readonly<{
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  idempotencyKey?: string;
  parseAs?: ApiClientParseMode;
  signal?: AbortSignal;
}>;

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_GET_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 300;

function normalizeMethod(method: string | undefined): string {
  return (method ?? "GET").toUpperCase();
}

function isSafeRetryMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

function isAuthMutation(url: string, method: string): boolean {
  if (method !== "POST") return false;
  const lowered = url.toLowerCase();
  return lowered.includes("/login") || lowered.includes("/register") || lowered.includes("/auth");
}

function canRetryRequest(url: string, method: string, idempotencyKey?: string): boolean {
  if (isAuthMutation(url, method)) return false;
  if (isSafeRetryMethod(method)) return true;
  return Boolean(idempotencyKey);
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createRequestSignal(timeoutMs: number, externalSignal?: AbortSignal): { signal: AbortSignal; cleanup: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let timeoutReached = false;

  const timeout = window.setTimeout(() => {
    timeoutReached = true;
    controller.abort();
  }, timeoutMs);

  const abortFromExternalSignal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternalSignal);
    },
    timedOut: () => timeoutReached,
  };
}

async function parseResponse<T>(response: Response, parseAs: ApiClientParseMode): Promise<T> {
  if (parseAs === "empty") return undefined as T;
  if (parseAs === "text") return await response.text() as T;
  return await response.json() as T;
}

function createHeaders(headers: HeadersInit | undefined, idempotencyKey: string | undefined): Headers {
  const next = new Headers(headers);
  if (idempotencyKey && !next.has("Idempotency-Key")) {
    next.set("Idempotency-Key", idempotencyKey);
  }
  return next;
}

function mapError(error: unknown, timedOut: boolean): ApiClientError {
  if (timedOut) {
    return {
      code: "REQUEST_TIMEOUT",
      message: "The request timed out. Please check your connection and try again.",
    };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      code: "ABORTED",
      message: "The request was canceled.",
    };
  }

  return {
    code: "NETWORK_ERROR",
    message: "Picom could not reach the server. Please check your connection and try again.",
    details: error instanceof Error ? error.message : undefined,
  };
}

export function formatApiClientError(error: ApiClientError): string {
  switch (error.code) {
    case "REQUEST_TIMEOUT":
      return "The request timed out. Try again in a moment.";
    case "NETWORK_ERROR":
      return "Network connection failed. Check your connection and retry.";
    case "ABORTED":
      return "The request was canceled.";
    case "HTTP_ERROR":
      return error.status === 429 ? "Too many requests. Please wait and try again." : "The server could not complete the request.";
    case "INVALID_RESPONSE":
      return "The server returned an unexpected response.";
    case "SERVER_ERROR":
      return "Picom server is temporarily unavailable.";
  }
}

export const apiClient = {
  async request<T>(url: string, options: ApiClientRequestOptions = {}): Promise<ApiClientResult<T>> {
    const method = normalizeMethod(options.method);
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    const parseAs = options.parseAs ?? "json";
    const retryAllowed = canRetryRequest(url, method, options.idempotencyKey);
    const retries = retryAllowed ? options.retries ?? (isSafeRetryMethod(method) ? DEFAULT_GET_RETRIES : 1) : 0;
    const headers = createHeaders(options.headers, options.idempotencyKey);

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const requestSignal = createRequestSignal(timeoutMs, options.signal);

      try {
        const response = await fetch(url, {
          ...options,
          method,
          headers,
          signal: requestSignal.signal,
        });

        if (!response.ok) {
          const error: ApiClientError = {
            code: response.status >= 500 ? "SERVER_ERROR" : "HTTP_ERROR",
            message: `Request failed with status ${response.status}.`,
            status: response.status,
          };

          if (attempt < retries && shouldRetryStatus(response.status)) {
            requestSignal.cleanup();
            await wait(retryDelayMs * (attempt + 1));
            continue;
          }

          requestSignal.cleanup();
          return { ok: false, error };
        }

        try {
          const data = await parseResponse<T>(response, parseAs);
          requestSignal.cleanup();
          return { ok: true, data, response };
        } catch (parseError) {
          requestSignal.cleanup();
          return {
            ok: false,
            error: {
              code: "INVALID_RESPONSE",
              message: "The server returned an unexpected response.",
              details: parseError instanceof Error ? parseError.message : undefined,
            },
          };
        }
      } catch (error) {
        const mapped = mapError(error, requestSignal.timedOut());
        requestSignal.cleanup();

        if (attempt < retries && mapped.code !== "ABORTED") {
          await wait(retryDelayMs * (attempt + 1));
          continue;
        }

        return { ok: false, error: mapped };
      }
    }

    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: "Picom could not complete the request.",
      },
    };
  },
};
