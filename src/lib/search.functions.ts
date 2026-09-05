import { createServerFn } from "@tanstack/react-start";

export type ResultKind = "ayah" | "surah" | "hadith" | "athar";

export type SearchResult = {
  id: string;
  kind: ResultKind;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  reference: string;
  grade?: string;
  score: number;
};

export type SearchPayload = {
  results: SearchResult[];
  total: number;
  counts: Record<string, number>;
  hasMore: boolean;
  suggestion?: string;
  error?: string;
};

const PAGE_SIZE = 12;

export const webSearch = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; category: string; book?: string; limit?: number }) => ({
    query: String(input.query ?? "").slice(0, 200),
    category: String(input.category ?? "all"),
    book: input.book ? String(input.book) : undefined,
    limit: Math.min(120, Math.max(PAGE_SIZE, Number(input.limit ?? PAGE_SIZE))),
  }))
  .handler(async ({ data }): Promise<SearchPayload> => {
    const q = data.query.trim();
    const empty: SearchPayload = { results: [], total: 0, counts: {}, hasMore: false };
    if (!q) return empty;

    const { searchQuran, searchSurahs, searchHadith, searchAthar, searchAll } = await import(
      "@/lib/search.server"
    );
    const books = data.book ? [data.book] : undefined;

    try {
      let all: SearchResult[];
      switch (data.category) {
        case "surah":
          all = await searchSurahs(q);
          break;
        case "hadith":
          all = await searchHadith(q, books);
          break;
        case "athar":
          all = await searchAthar(q, books);
          break;
        case "ayat":
          all = await searchQuran(q);
          break;
        default:
          all = await searchAll(q);
      }

      const counts: Record<string, number> = {};
      for (const r of all) counts[r.kind] = (counts[r.kind] ?? 0) + 1;

      const results = all.slice(0, data.limit);
      return {
        results,
        total: all.length,
        counts,
        hasMore: all.length > results.length,
      };
    } catch {
      return { ...empty, error: "upstream" };
    }
  });
