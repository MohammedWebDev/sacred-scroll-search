// Google Programmable Search (Custom Search JSON API) integration.
// Server-only: reads the API key from the runtime env inside the caller's handler.

export type WebResult = {
  id: string;
  title: string;
  link: string;
  displayLink: string;
  formattedUrl: string;
  snippet: string;
  favicon: string;
  thumbnail?: string;
  siteName?: string;
  published?: string;
};

export type WebSearchPayload = {
  results: WebResult[];
  total: number;
  start: number;
  nextStart?: number;
  spelling?: string;
  error?: "empty" | "quota" | "timeout" | "network" | "config" | "upstream";
};

export const GOOGLE_CX = "238bd6009d27343a2";

const ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const TIMEOUT_MS = 9_000;
const PAGE_SIZE = 10;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 120;

const cache = new Map<string, { at: number; payload: WebSearchPayload }>();

/** Strip control chars / operators abuse, collapse whitespace, clamp length. */
export function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/["'`<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function faviconFor(link: string): string {
  try {
    const host = new URL(link).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`;
  } catch {
    return "";
  }
}

function displayHostFor(link: string, fallback: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

type RawItem = {
  title?: string;
  link?: string;
  displayLink?: string;
  formattedUrl?: string;
  htmlFormattedUrl?: string;
  snippet?: string;
  pagemap?: {
    cse_thumbnail?: { src?: string }[];
    cse_image?: { src?: string }[];
    metatags?: Record<string, string>[];
  };
};

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function mapItem(item: RawItem, index: number, start: number): WebResult | null {
  const link = item.link?.trim();
  if (!link || !/^https?:\/\//i.test(link)) return null;
  const meta = item.pagemap?.metatags?.[0] ?? {};
  const thumb = item.pagemap?.cse_thumbnail?.[0]?.src ?? item.pagemap?.cse_image?.[0]?.src;
  return {
    id: `${start + index}-${link}`,
    title: stripHtml(item.title ?? link),
    link,
    displayLink: displayHostFor(link, item.displayLink ?? ""),
    formattedUrl: stripHtml(item.formattedUrl ?? link),
    snippet: stripHtml(item.snippet ?? ""),
    favicon: faviconFor(link),
    ...(thumb ? { thumbnail: thumb } : {}),
    ...(meta["og:site_name"] ? { siteName: stripHtml(meta["og:site_name"]!) } : {}),
    ...(meta["article:published_time"]
      ? { published: meta["article:published_time"]! }
      : {}),
  };
}

/** Trusted Islamic domains float to the top; junk aggregators sink. */
const TRUSTED = [
  "quran.com",
  "sunnah.com",
  "dorar.net",
  "islamweb.net",
  "islamqa.info",
  "binbaz.org.sa",
  "alukah.net",
  "shamela.ws",
  "tafsir.app",
  "quranenc.com",
  "hadeethenc.com",
  "ar.wikipedia.org",
];
const DEMOTED = ["pinterest.", "facebook.com", "tiktok.com", "x.com", "twitter.com"];

function rank(results: WebResult[], query: string): WebResult[] {
  const words = query.split(" ").filter((w) => w.length > 2);
  const scored = results.map((r, i) => {
    let score = 100 - i; // preserve Google's ordering as the base signal
    const host = r.displayLink;
    if (TRUSTED.some((d) => host.endsWith(d))) score += 30;
    if (DEMOTED.some((d) => host.includes(d))) score -= 45;
    if (!r.snippet) score -= 10;
    const hay = `${r.title} ${r.snippet}`;
    score += words.filter((w) => hay.includes(w)).length * 4;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  return scored
    .map((s) => s.r)
    .filter((r) => {
      const key = r.link.replace(/[#?].*$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function cacheGet(key: string): WebSearchPayload | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.payload;
}

function cacheSet(key: string, payload: WebSearchPayload) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), payload });
}

export async function googleWebSearch(opts: {
  apiKey: string | undefined;
  query: string;
  start?: number;
  site?: string | undefined;
}): Promise<WebSearchPayload> {
  const query = sanitizeQuery(opts.query);
  const start = Math.min(Math.max(Math.trunc(opts.start ?? 1), 1), 91);
  if (!query) return { results: [], total: 0, start, error: "empty" };
  if (!opts.apiKey) return { results: [], total: 0, start, error: "config" };

  const q = opts.site ? `${query} site:${opts.site}` : query;
  const key = `${q}|${start}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = new URL(ENDPOINT);
  url.searchParams.set("key", opts.apiKey);
  url.searchParams.set("cx", GOOGLE_CX);
  url.searchParams.set("q", q);
  url.searchParams.set("num", String(PAGE_SIZE));
  url.searchParams.set("start", String(start));
  url.searchParams.set("hl", "ar");
  url.searchParams.set("lr", "lang_ar");
  url.searchParams.set("safe", "active");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 429 || res.status === 403) {
      const body = await res.text().catch(() => "");
      // 403 also covers "API not enabled" / restricted key — that is config, not quota.
      const isConfig = /does not have the access|has not been used|disabled|API_KEY/i.test(body);
      return { results: [], total: 0, start, error: isConfig ? "config" : "quota" };
    }
    if (!res.ok) return { results: [], total: 0, start, error: "upstream" };

    const json = (await res.json()) as {
      items?: RawItem[];
      spelling?: { correctedQuery?: string };
      queries?: { nextPage?: { startIndex?: number }[] };
      searchInformation?: { totalResults?: string };
    };

    const items = (json.items ?? [])
      .map((item, i) => mapItem(item, i, start))
      .filter((r): r is WebResult => r !== null);

    const payload: WebSearchPayload = {
      results: rank(items, query),
      total: Number(json.searchInformation?.totalResults ?? items.length) || items.length,
      start,
      ...(json.queries?.nextPage?.[0]?.startIndex
        ? { nextStart: json.queries.nextPage[0].startIndex! }
        : {}),
      ...(json.spelling?.correctedQuery
        ? { spelling: stripHtml(json.spelling.correctedQuery) }
        : {}),
    };
    cacheSet(key, payload);
    return payload;
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { results: [], total: 0, start, error: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/** Lightweight suggestion source: Google autocomplete, degrades to [] silently. */
export async function googleSuggest(raw: string): Promise<string[]> {
  const query = sanitizeQuery(raw);
  if (query.length < 2) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_500);
  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&hl=ar&q=${encodeURIComponent(query)}`,
      { signal: controller.signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as [string, string[]];
    return (data[1] ?? []).slice(0, 8);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
