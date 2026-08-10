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
    const { googleWebSearch } = await import("@/lib/google.server");
    return googleWebSearch({
      apiKey: process.env["GOOGLE_API_KEY"] ?? process.env["VITE_GOOGLE_SEARCH_API_KEY"],
      query: data.query,
      start: data.start,
      site: data.site,
    });
  });

export const querySuggestions = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => ({ query: String(input.query ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<{ suggestions: string[] }> => {
    const { googleSuggest } = await import("@/lib/google.server");
    return { suggestions: await googleSuggest(data.query) };
  });
