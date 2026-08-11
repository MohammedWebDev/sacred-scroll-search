import { createServerFn } from "@tanstack/react-start";
import type { WebSearchPayload } from "@/lib/google.server";

export type { WebResult, WebSearchPayload } from "@/lib/google.server";

export const googleSearch = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; start?: number; site?: string }) => ({
    query: String(input.query ?? "").slice(0, 200),
    start: Number.isFinite(Number(input.start)) ? Number(input.start) : 1,
    site: input.site ? String(input.site).slice(0, 80) : undefined,
  }))
  .handler(async ({ data }): Promise<WebSearchPayload> => {
    const [{ googleWebSearch }, { getSearchConfig }] = await Promise.all([
      import("@/lib/google.server"),
      import("@/lib/searchConfig"),
    ]);
    const { apiKey, cx } = getSearchConfig();

    const payload = await googleWebSearch({
      apiKey,
      cx,
      query: data.query,
      start: data.start,
      site: data.site,
    });

    // Resilience: if Google is unavailable (bad key, quota, network), serve the
    // internal Islamic sources so the browser never dead-ends on the user.
    if (payload.error && payload.error !== "empty" && (data.start ?? 1) <= 1) {
      const { toWebFallback } = await import("@/lib/google.fallback.server");
      const fallback = await toWebFallback(data.query);
      if (fallback.length) {
        return { results: fallback, total: fallback.length, start: 1, fallback: true };
      }
    }

    return payload;
  });

export const querySuggestions = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => ({ query: String(input.query ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<{ suggestions: string[] }> => {
    const { googleSuggest } = await import("@/lib/google.server");
    return { suggestions: await googleSuggest(data.query) };
  });
