import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  BookOpen,
  ScrollText,
  Library,
  Feather,
  ExternalLink,
  History,
  X,
  Filter,
} from "lucide-react";
import pattern from "@/assets/pattern.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نور — متصفح البحث في الآيات والأحاديث والسور والآثار" },
      {
        name: "description",
        content:
          "متصفح إسلامي حديث يعتمد على محرك بحث جوجل للبحث المرتب في القرآن الكريم والأحاديث النبوية والسور وآثار السلف من مصادر موثوقة.",
      },
      { property: "og:title", content: "نور — بحث إسلامي مرتّب وسهل" },
      {
        property: "og:description",
        content: "ابحث في الآيات والأحاديث والسور والآثار عبر مصادر موثوقة بنقرة واحدة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Category = {
  id: string;
  label: string;
  hint: string;
  icon: typeof BookOpen;
  sites: { name: string; domain: string }[];
  suggestions: string[];
};

const CATEGORIES: Category[] = [
  {
    id: "ayat",
    label: "الآيات",
    hint: "ابحث عن آية أو معنى في القرآن الكريم",
    icon: BookOpen,
    sites: [
      { name: "القرآن الكريم", domain: "quran.com" },
      { name: "تنزيل", domain: "tanzil.net" },
      { name: "التفسير", domain: "altafsir.com" },
      { name: "الباحث القرآني", domain: "tafsir.app" },
    ],
    suggestions: ["آية الكرسي", "آيات الصبر", "الرزق", "بر الوالدين", "التوبة والاستغفار"],
  },
  {
    id: "hadith",
    label: "الأحاديث",
    hint: "ابحث في كتب السنة مع بيان درجة الحديث",
    icon: ScrollText,
    sites: [
      { name: "سنة", domain: "sunnah.com" },
      { name: "الدرر السنية", domain: "dorar.net" },
      { name: "إسلام ويب", domain: "islamweb.net" },
      { name: "الشاملة", domain: "shamela.ws" },
    ],
    suggestions: ["إنما الأعمال بالنيات", "فضل الصلاة", "حسن الخلق", "صيام عاشوراء", "الأربعون النووية"],
  },
  {
    id: "surah",
    label: "السور",
    hint: "اقرأ سورة كاملة مع التفسير والتلاوة",
    icon: Library,
    sites: [
      { name: "القرآن الكريم", domain: "quran.com" },
      { name: "الباحث القرآني", domain: "tafsir.app" },
      { name: "تنزيل", domain: "tanzil.net" },
    ],
    suggestions: ["سورة الكهف", "سورة يس", "سورة الملك", "سورة الرحمن", "سورة البقرة"],
  },
  {
    id: "athar",
    label: "الآثار",
    hint: "أقوال الصحابة والتابعين وسلف الأمة",
    icon: Feather,
    sites: [
      { name: "الدرر السنية", domain: "dorar.net" },
      { name: "الشاملة", domain: "shamela.ws" },
      { name: "الألوكة", domain: "alukah.net" },
      { name: "إسلام ويب", domain: "islamweb.net" },
    ],
    suggestions: ["أثر عن عمر بن الخطاب", "أقوال الحسن البصري", "آثار السلف في الزهد", "قول ابن مسعود"],
  },
];

const STORAGE_KEY = "noor-recent-searches";

function Index() {
  const [active, setActive] = useState(CATEGORIES[0]!);
  const [query, setQuery] = useState("");
  const [site, setSite] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setSite(null);
  }, [active]);

  const targets = useMemo(
    () => (site ? [site] : active.sites.map((s) => s.domain)),
    [site, active],
  );

  const run = (term: string) => {
    const q = term.trim();
    if (!q) return;
    const scope = targets.map((d) => `site:${d}`).join(" OR ");
    const url = `https://www.google.com/search?q=${encodeURIComponent(`${q} (${scope})`)}`;
    const next = [q, ...recent.filter((r) => r !== q)].slice(0, 8);
    setRecent(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    window.open(url, "_blank", "noopener,noreferrer");
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
            بحث مدعوم بجوجل
          </span>
        </header>

        <div className="mx-auto max-w-3xl px-5 pb-14 pt-10 text-center">
          <h1 className="font-display text-3xl leading-snug text-primary-foreground sm:text-5xl">
            ابحث في الآيات والأحاديث والسور والآثار
          </h1>
          <p className="mt-3 text-sm text-primary-foreground/70 sm:text-base">
            نتائج مرتّبة من مصادر إسلامية موثوقة فقط، لتسهيل الوصول للمعلومة على كل مسلم.
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
        <section>
          <h2 className="flex items-center gap-2 font-display text-xl text-foreground">
            <Filter className="size-4 text-primary" /> تحديد المصدر
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setSite(null)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                site === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              }`}
            >
              كل المصادر الموثوقة
            </button>
            {active.sites.map((s) => (
              <button
                key={s.domain}
                onClick={() => setSite(s.domain)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  site === s.domain
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </section>

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
          نتائج البحث تُعرض عبر جوجل مقيّدة بمواقع إسلامية موثوقة. تحقّق دائمًا من صحة الحديث ودرجته.
        </div>
      </footer>
    </div>
  );
}
