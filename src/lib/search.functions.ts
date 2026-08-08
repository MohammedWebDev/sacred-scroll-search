import { createServerFn } from "@tanstack/react-start";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

export const webSearch = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; category: string; book?: string }) => ({
    query: String(input.query ?? "").slice(0, 200),
    category: String(input.category ?? "ayat"),
    book: input.book ? String(input.book) : undefined,
  }))
  .handler(async ({ data }): Promise<{ results: SearchResult[]; error?: string }> => {
    const q = data.query.trim();
    if (!q) return { results: [] };
    const { searchQuran, searchSurahs, searchHadith } = await import("@/lib/search.server");
    try {
      if (data.category === "surah") return { results: await searchSurahs(q) };
      if (data.category === "hadith" || data.category === "athar") {
        return { results: await searchHadith(q, data.book ? [data.book] : undefined) };
      }
      return { results: await searchQuran(q) };
    } catch {
      return { results: [], error: "upstream" };
    }
  });
