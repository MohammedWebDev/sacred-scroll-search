import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, ArrowRight, Loader2, Filter, Moon, Sun } from "lucide-react";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { webSearch } from "@/lib/search.functions";
import { ResultCard } from "@/components/ResultCard";
import { WebResults } from "@/components/WebResults";
import { SearchSuggestions } from "@/components/SearchSuggestions";

import { useTheme } from "@/lib/theme";
import { bumpStats } from "@/lib/stats";

type SearchParams = { q: string; cat?: string | undefined; book?: string | undefined };

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: String(search["q"] ?? ""),
    cat: search["cat"] ? String(search["cat"]) : undefined,
    book: search["book"] ? String(search["book"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "نتائج البحث — متصفح رقيم" },
      {
        name: "description",
        content: "نتائج بحث ذكية ومرتّبة في الآيات والأحاديث والسور والآثار من مصادر موثوقة.",
      },
      { property: "og:title", content: "نتائج البحث — متصفح رقيم" },
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
  const { q, cat, book } = Route.useSearch();
  const navigate = useNavigate();
  const category = getCategory(cat);
  const [term, setTerm] = useState(q);
  const [focused, setFocused] = useState(false);

  const { theme, toggle } = useTheme();

  useEffect(() => setTerm(q), [q]);

  const runSearch = useServerFn(webSearch);

  const isWeb = category.id === "web";

  const { data, isFetching } = useQuery({
    queryKey: ["search", q, category.id, book ?? "all"],
    queryFn: () =>
      runSearch({
        data: { query: q, category: category.id, ...(book ? { book } : {}) },
      }),
    enabled: !isWeb && q.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (data) bumpStats({ searches: 1, results: data.results.length });
  }, [data]);


  const go = (next: Partial<SearchParams>) =>
    navigate({
      to: "/search",
      search: (prev: Partial<SearchParams>) => ({ ...prev, q: prev.q ?? q, ...next }) as SearchParams,
    });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center gap-2 sm:gap-3">
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
                setFocused(false);
                if (term.trim()) go({ q: term.trim() });
              }}
              className="relative flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3"
            >
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 120)}
                aria-label="حقل البحث"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                بحث
              </button>
              {focused && term.trim().length >= 2 && (
                <SearchSuggestions
                  term={term}
                  onPick={(value) => {
                    setTerm(value);
                    setFocused(false);
                    go({ q: value });
                  }}
                />
              )}
            </form>

            <button
              onClick={toggle}
              aria-label="تبديل الوضع الليلي"
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted"
            >
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((c) => {
              const on = c.id === category.id;
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => go({ cat: c.id, book: undefined })}
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
        {category.filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="size-3.5 text-primary" />
            <button
              onClick={() => go({ book: undefined })}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                !book
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              كل الكتب
            </button>
            {category.filters.map((f) => (
              <button
                key={f.value}
                onClick={() => go({ book: f.value })}
                className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                  book === f.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        {category.id === "athar" && (
          <p className="mt-4 rounded-xl border border-border bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
            الآثار هي أقوال الصحابة والتابعين وأتباعهم ومروياتهم وحِكَمهم، وهي ليست أحاديث نبوية.
          </p>
        )}

        {isWeb ? (
          q.trim() ? (
            <WebResults query={q} site={book} />
          ) : (
            <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              اكتب كلمة للبحث في الويب.
            </div>
          )
        ) : (
          <>
            {isFetching && (
              <div className="mt-10 flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> جارٍ البحث في المصادر…
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
                    <ResultCard key={r.id} result={r} query={q} />
                  ))}
                </ul>

                {data.results.length === 0 && (
                  <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                    لم نعثر على نتائج. جرّب اسم السورة، أو رقم الآية (مثل «البقرة 255»)، أو كلمة
                    أخرى، أو اختر تصنيف «الكل».
                  </div>
                )}
              </>
            )}
          </>
        )}

      </main>
    </div>
  );
}
