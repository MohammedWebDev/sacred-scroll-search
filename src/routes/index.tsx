import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Search,
  ScrollText,
  History,
  X,
  Moon,
  Sun,
  Users,
  Activity,
  Eye,
  BookOpen,
  ArrowLeft,
} from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { useTheme } from "@/lib/theme";
import { bumpStats, readStats, LIBRARY, type Stats } from "@/lib/stats";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "متصفح رقيم — بحث ذكي في الآيات والأحاديث والسور والآثار" },
      {
        name: "description",
        content:
          "متصفح رقيم: محرك بحث إسلامي ذكي يبحث بنص الآية أو اسم السورة أو رقم الآية والحديث، مع الأحاديث وآثار الصحابة والتابعين.",
      },
      { property: "og:title", content: "متصفح رقيم — بحث إسلامي ذكي" },
      {
        property: "og:description",
        content: "ابحث باسم السورة أو رقم الآية أو نص الحديث، وشاهد النتائج داخل الموقع مباشرة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "raqeem-recent-searches";

function Index() {
  const [active, setActive] = useState(CATEGORIES[0]!);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setStats(bumpStats({ visits: 1 }));
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
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/12 via-background to-background">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ScrollText className="size-5" />
            </span>
            <span className="text-2xl font-extrabold text-foreground">متصفح رقيم</span>
          </div>
          <button
            onClick={toggle}
            aria-label="تبديل الوضع الليلي"
            className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-muted"
          >
            {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </button>
        </header>

        <div className="mx-auto max-w-3xl px-5 pb-14 pt-10 text-center">
          <h1 className="text-3xl font-extrabold leading-snug text-foreground sm:text-5xl">
            ابحث بذكاء في الآيات والأحاديث والسور والآثار
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            ابحث بالنص، أو باسم السورة، أو برقم الآية أو الحديث — مثل «البقرة 255» أو «البخاري 1».
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(query);
            }}
            className="mt-8 flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-glow)]"
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
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
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
                      ? "border-primary bg-primary font-bold text-primary-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50"
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
          <h2 className="text-xl font-bold text-foreground">إحصائيات المتصفح</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Eye} label="زياراتك" value={stats?.visits ?? 0} />
            <StatCard icon={Activity} label="عمليات بحثك" value={stats?.searches ?? 0} />
            <StatCard icon={Users} label="نتائج عُرضت لك" value={stats?.results ?? 0} />
            <StatCard
              icon={BookOpen}
              label="محتوى المكتبة"
              value={LIBRARY.ayat}
              suffix={`آية · ${LIBRARY.suwar} سورة · ${LIBRARY.books} كتب`}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            تُحتسب الإحصائيات محليًا على جهازك للحفاظ على خصوصيتك.
          </p>
        </section>

        <section className="mt-9">
          <h2 className="text-xl font-bold text-foreground">بحث سريع في {active.label}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s);
                  run(s);
                }}
                className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-right shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-primary"
              >
                <span className="text-lg font-semibold text-foreground">{s}</span>
                <ArrowLeft className="size-4 text-muted-foreground transition group-hover:text-primary" />
              </button>
            ))}
          </div>
        </section>

        {recent.length > 0 && (
          <section className="mt-9">
            <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
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
          متصفح رقيم — نتائج من القرآن الكريم وكتب السنة وآثار السلف. تحقّق دائمًا من درجة الحديث.
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-foreground">
        {value.toLocaleString("ar-EG")}
      </div>
      {suffix && <div className="mt-1 text-xs text-muted-foreground">{suffix}</div>}
    </div>
  );
}
