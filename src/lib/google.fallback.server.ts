// Fallback provider: maps internal Islamic-source results into the web-result
// shape used by the SERP, so the UI stays useful when Google is unreachable.
import type { WebResult } from "@/lib/google.server";

export async function toWebFallback(query: string): Promise<WebResult[]> {
  try {
    const { searchAll } = await import("@/lib/search.server");
    const results = await searchAll(query);
    return results.slice(0, 20).map((r, i) => ({
      id: `fallback-${i}-${r.id}`,
      title: r.title,
      link: r.url,
      displayLink: r.domain,
      formattedUrl: r.url,
      snippet: r.snippet,
      favicon: r.domain
        ? `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(r.domain)}`
        : "",
      ...(r.reference ? { siteName: r.reference } : {}),
    }));
  } catch {
    return [];
  }
}
