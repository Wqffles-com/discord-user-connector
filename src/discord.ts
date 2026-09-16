const API_BASE = "https://discord.com/api/v10";

export const CLIENT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9173 Chrome/124.0.6367.243 Electron/30.3.1 Safari/537.36",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Origin": "https://discord.com",
  "Referer": "https://discord.com/channels/@me",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "X-Debug-Options": "gatewayOverlay",
  "X-Discord-Locale": "en-US",
} as const;

export class DiscordApiError extends Error {
  status: number;
  code?: number;

  constructor(status: number, body: unknown) {
    const b = body as { message?: string; code?: number } | null;
    super(`Discord API ${status}: ${b?.message ?? "unknown error"}`);
    this.name = "DiscordApiError";
    this.status = status;
    this.code = b?.code;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class DiscordClient {
  private token: string;
  private minDelayMs: number;
  private lastRequestAt = 0;

  constructor(token: string, minDelayMs = 350) {
    this.token = token;
    this.minDelayMs = minDelayMs;
  }

  private async pace(): Promise<void> {
    const wait = this.minDelayMs - (Date.now() - this.lastRequestAt);
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }

  async request<T>(
    method: string,
    path: string,
    opts: {
      query?: Record<string, string | number | undefined>;
      body?: unknown;
    } = {},
    attempt = 0,
  ): Promise<T> {
    await this.pace();

    const url = new URL(API_BASE + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    const res = await fetch(url, {
      method,
      headers: {
        ...CLIENT_HEADERS,
        Authorization: this.token,
        "Content-Type": "application/json",
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(20000),
    });

    if (res.status === 429 && attempt < 2) {
      const b = (await res.json().catch(() => null)) as { retry_after?: number } | null;
      const retry = Number(b?.retry_after ?? res.headers.get("retry-after") ?? 1);
      await sleep(Math.min(30000, Math.max(0, retry * 1000)) + 100);
      return this.request<T>(method, path, opts, attempt + 1);
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(600 * (attempt + 1));
      return this.request<T>(method, path, opts, attempt + 1);
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) throw new DiscordApiError(res.status, body);
    return body as T;
  }

  get<T>(path: string, query?: Record<string, string | number | undefined>) {
    return this.request<T>("GET", path, { query });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>("POST", path, { body });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, { body });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, { body });
  }

  del<T>(path: string) {
    return this.request<T>("DELETE", path);
  }
}
