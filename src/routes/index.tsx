import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Search,
  BookOpen,
  ExternalLink,
  History,
  X,
} from "lucide-react";
import pattern from "@/assets/pattern.jpg";
import { CATEGORIES } from "@/lib/categories";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نور — متصفح البحث في الآيات والأحاديث والسور والآثار" },
      {
        name: "description",
        content:
          "متصفح إسلامي حديث للبحث المرتب في القرآن الكريم والأحاديث النبوية والسور وآثار السلف من مصادر موثوقة.",
      },
      { property: "og:title", content: "نور — بحث إسلامي مرتّب وسهل" },
      {
        property: "og:description",
        content: "ابحث في الآيات والأحاديث والسور والآثار وشاهد النتائج داخل الموقع مباشرة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "noor-recent-searches";

function Index() {
  const [active, setActive] = useState(CATEGORIES[0]!);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const navigate = useNavigate();

  const run = (term: string) => {
    const q = term.trim();
    if (!q) return;
    const next = [q, ...recent.filter((r) => r !== q)].slice(0, 8);
    setRecent(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    navigate({ to: "/search", search: { q, cat: active.id } });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background font-sans">
      <div
        className="relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(to bottom, oklch(0.3 0.07 158 / 0.94), oklch(0.24 0.05 158 / 0.97)), url(${pattern})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-gold/20 text-gold">
              <BookOpen className="size-5" />
            </span>
            <span className="font-display text-2xl text-primary-foreground">نـور</span>
          </div>
          <span className="rounded-full border border-gold/30 px-3 py-1 text-xs text-gold">
            نتائج داخل الموقع
          </span>
        </header>

        <div className="mx-auto max-w-3xl px-5 pb-14 pt-10 text-center">
          <h1 className="font-display text-3xl leading-snug text-primary-foreground sm:text-5xl">
            ابحث في الآيات والأحاديث والسور والآثار
          </h1>
          <p className="mt-3 text-sm text-primary-foreground/70 sm:text-base">
            نتائج تُعرض داخل الموقع مباشرة من مصادر موثوقة، لتسهيل الوصول للمعلومة على كل مسلم.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(query);
            }}
            className="mt-8 flex items-center gap-2 rounded-2xl bg-card p-2 shadow-[var(--shadow-glow)]"
          >
            <Search className="mr-2 size-5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={active.hint}
              aria-label="حقل البحث"
              className="min-w-0 flex-1 bg-transparent py-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="مسح"
                className="rounded-full p-1 text-muted-foreground transition hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            )}
            <button
              type="submit"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              بحث
            </button>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const on = c.id === active.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActive(c)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                    on
                      ? "border-gold bg-gold text-gold-foreground font-semibold"
                      : "border-primary-foreground/20 text-primary-foreground/80 hover:border-gold/50"
                  }`}
                >
                  <Icon className="size-4" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-5 py-10">
        <section className="mt-9">
          <h2 className="font-display text-xl text-foreground">بحث سريع في {active.label}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s);
                  run(s);
                }}
                className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-right shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-gold"
              >
                <span className="font-display text-lg text-foreground">{s}</span>
                <ExternalLink className="size-4 text-muted-foreground transition group-hover:text-primary" />
              </button>
            ))}
          </div>
        </section>

        {recent.length > 0 && (
          <section className="mt-9">
            <h2 className="flex items-center gap-2 font-display text-xl text-foreground">
              <History className="size-4 text-primary" /> عمليات بحث سابقة
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => run(r)}
                  className="rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground transition hover:bg-muted"
                >
                  {r}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-5 py-6 text-center text-sm text-muted-foreground">
          تُعرض النتائج داخل الموقع من مصادر موثوقة (القرآن الكريم وكتب السنة). تحقّق دائمًا من درجة الحديث.
        </div>
      </footer>
    </div>
  );
}
