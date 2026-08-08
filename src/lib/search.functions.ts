import { createServerFn } from "@tanstack/react-start";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

function decodeEntities(s: string) {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function cleanUrl(href: string) {
  let url = href;
  if (url.startsWith("//")) url = `https:${url}`;
  try {
    const u = new URL(url);
    const uddg = u.searchParams.get("uddg");
    if (uddg) return uddg;
    if (u.pathname === "/url" || u.pathname === "/l/") {
      const q = u.searchParams.get("q") || u.searchParams.get("url");
      if (q) return q;
    }
    return u.toString();
  } catch {
    return url;
  }
}

function parseDuckDuckGo(html: string): SearchResult[] {
  const out: SearchResult[] = [];
  const blocks = html.split('class="result__body"').slice(1);
  for (const block of blocks) {
    const linkMatch = block.match(/<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;
    const snippetMatch = block.match(
      /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/,
    );
    const url = cleanUrl(decodeEntities(linkMatch[1] ?? ""));
    const title = decodeEntities(linkMatch[2] ?? "");
    if (!url || !title) continue;
    let domain = "";
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
    out.push({
      title,
      url,
      snippet: decodeEntities(snippetMatch?.[1] ?? snippetMatch?.[2] ?? ""),
      domain,
    });
  }
  return out;
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "ar,en;q=0.8",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  return res.text();
}

export const webSearch = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; sites: string[] }) => ({
    query: String(input.query ?? "").slice(0, 200),
    sites: (input.sites ?? []).slice(0, 8).map((s) => String(s)),
  }))
  .handler(async ({ data }): Promise<{ results: SearchResult[]; error?: string }> => {
    const q = data.query.trim();
    if (!q) return { results: [] };
    const scope = data.sites.length ? ` (${data.sites.map((d) => `site:${d}`).join(" OR ")})` : "";
    const full = `${q}${scope}`;

    try {
      const html = await fetchHtml(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(full)}&kl=xa-ar`,
      );
      const results = parseDuckDuckGo(html).slice(0, 20);
      if (results.length) return { results };
      return { results: [], error: "no-results" };
    } catch {
      return { results: [], error: "upstream" };
    }
  });
