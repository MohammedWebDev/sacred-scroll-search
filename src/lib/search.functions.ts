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

export const webSearch = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; category: string; book?: string }) => ({
    query: String(input.query ?? "").slice(0, 200),
    category: String(input.category ?? "all"),
    book: input.book ? String(input.book) : undefined,
  }))
  .handler(async ({ data }): Promise<{ results: SearchResult[]; error?: string }> => {
    const q = data.query.trim();
    if (!q) return { results: [] };
    const { searchQuran, searchSurahs, searchHadith, searchAthar, searchAll } = await import(
      "@/lib/search.server"
    );
    const books = data.book ? [data.book] : undefined;
    try {
      switch (data.category) {
        case "surah":
          return { results: await searchSurahs(q) };
        case "hadith":
          return { results: await searchHadith(q, books) };
        case "athar":
          return { results: await searchAthar(q, books) };
        case "ayat":
          return { results: await searchQuran(q) };
        default:
          return { results: await searchAll(q) };
      }
    } catch {
      return { results: [], error: "upstream" };
    }
  });
