import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, ArrowRight, ExternalLink, Loader2, Filter } from "lucide-react";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { webSearch } from "@/lib/search.functions";

type SearchParams = { q: string; cat?: string; site?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: String(search["q"] ?? ""),
    cat: search["cat"] ? String(search["cat"]) : undefined,
    site: search["site"] ? String(search["site"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "نتائج البحث — نور للبحث في الآيات والأحاديث" },
      {
        name: "description",
        content: "نتائج بحث مرتّبة من مصادر إسلامية موثوقة في الآيات والأحاديث والسور والآثار.",
      },
      { property: "og:title", content: "نتائج البحث — نور" },
      {
        property: "og:description",
        content: "استعرض نتائج البحث الإسلامي داخل الموقع دون مغادرة الصفحة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, cat, site } = Route.useSearch();
  const navigate = useNavigate();
  const category = getCategory(cat);
  const [term, setTerm] = useState(q);

  useEffect(() => setTerm(q), [q]);

  const sites = site ? [site] : category.sites.map((s) => s.domain);
  const runSearch = useServerFn(webSearch);

  const { data, isFetching } = useQuery({
    queryKey: ["search", q, category.id, site ?? "all"],
    queryFn: () => runSearch({ data: { query: q, sites } }),
    enabled: q.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const go = (next: Partial<SearchParams>) =>
    navigate({
      to: "/search",
      search: (prev) => ({ ...prev, ...next }) as SearchParams,
    });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: "/" })}
              aria-label="العودة"
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted"
            >
              <ArrowRight className="size-5" />
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (term.trim()) go({ q: term.trim() });
              }}
              className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3"
            >
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                aria-label="حقل البحث"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                بحث
              </button>
            </form>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => {
              const on = c.id === category.id;
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => go({ cat: c.id, site: undefined })}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="size-3.5 text-primary" />
          <button
            onClick={() => go({ site: undefined })}
            className={`rounded-lg border px-2.5 py-1 text-xs transition ${
              !site
                ? "border-gold bg-gold text-gold-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            كل المصادر
          </button>
          {category.sites.map((s) => (
            <button
              key={s.domain}
              onClick={() => go({ site: s.domain })}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                site === s.domain
                  ? "border-gold bg-gold text-gold-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {isFetching && (
          <div className="mt-10 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> جارٍ جلب النتائج…
          </div>
        )}

        {!isFetching && data && (
          <>
            <p className="mt-6 text-xs text-muted-foreground">
              {data.results.length > 0
                ? `${data.results.length} نتيجة عن «${q}» ضمن ${category.label}`
                : "لا توجد نتائج"}
            </p>

            <ul className="mt-3 space-y-3">
              {data.results.map((r) => (
                <li
                  key={r.url}
                  className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition hover:border-gold"
                >
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="flex items-center gap-2 text-xs text-primary">
                      {r.domain}
                      <ExternalLink className="size-3" />
                    </div>
                    <h2 className="mt-1 font-display text-lg leading-snug text-foreground">
                      {r.title}
                    </h2>
                    {r.snippet && (
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {r.snippet}
                      </p>
                    )}
                  </a>
                </li>
              ))}
            </ul>

            {data.results.length === 0 && (
              <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                لم نعثر على نتائج ضمن المصادر المحددة. جرّب كلمات أخرى أو اختر «كل المصادر».
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
