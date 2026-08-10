import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2, SearchX, WifiOff } from "lucide-react";
import { googleSearch, type WebSearchPayload } from "@/lib/google.functions";
import { WebResultCard, WebResultSkeleton } from "@/components/WebResultCard";

const ERROR_COPY: Record<string, { title: string; body: string; icon: typeof WifiOff }> = {
  quota: {
    title: "تم بلوغ حد البحث المسموح مؤقتًا",
    body: "حصة البحث اليومية انتهت أو المفتاح مقيّد. جرّب لاحقًا أو استخدم تصنيفات المصادر الأخرى.",
    icon: AlertTriangle,
  },
  timeout: {
    title: "استغرق البحث وقتًا طويلًا",
    body: "انتهت مهلة الاتصال بمحرك البحث. أعد المحاولة.",
    icon: WifiOff,
  },
  network: {
    title: "تعذّر الاتصال بالشبكة",
    body: "تحقّق من اتصالك بالإنترنت ثم أعد المحاولة.",
    icon: WifiOff,
  },
  config: {
    title: "محرك البحث غير مهيأ",
    body: "مفتاح خدمة البحث غير متوفر حاليًا.",
    icon: AlertTriangle,
  },
  upstream: {
    title: "خطأ من محرك البحث",
    body: "لم نستطع جلب النتائج الآن. أعد المحاولة بعد قليل.",
    icon: AlertTriangle,
  },
};

export function WebResults({ query, site }: { query: string; site?: string | undefined }) {
  const run = useServerFn(googleSearch);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const { data, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery<WebSearchPayload>({
      queryKey: ["google", query, site ?? "all"],
      initialPageParam: 1,
      queryFn: ({ pageParam }) =>
        run({ data: { query, start: Number(pageParam), ...(site ? { site } : {}) } }),
      getNextPageParam: (last) => last.nextStart ?? undefined,
      enabled: query.trim().length > 0,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    });

  const pages = data?.pages ?? [];
  const results = pages.flatMap((p) => p.results);
  const failure = pages[0]?.error;

  // Lazy loading: fetch the next page as the sentinel scrolls into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <ul className="mt-4 space-y-3" aria-busy="true" aria-label="جارٍ تحميل النتائج">
        {Array.from({ length: 5 }).map((_, i) => (
          <WebResultSkeleton key={i} />
        ))}
      </ul>
    );
  }

  if (isError || (failure && failure !== "empty")) {
    const copy = ERROR_COPY[failure ?? "network"] ?? ERROR_COPY["network"]!;
    const Icon = copy.icon;
    return (
      <div
        role="alert"
        className="mt-6 rounded-2xl border border-border bg-card p-6 text-center"
      >
        <Icon className="mx-auto size-6 text-primary" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-foreground">{copy.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.body}</p>
        <button
          onClick={() => void refetch()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center">
        <SearchX className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm text-muted-foreground">
          لا توجد نتائج على الويب عن «{query}». جرّب صياغة أخرى أو كلمات أقل.
        </p>
      </div>
    );
  }

  const total = pages[0]?.total ?? results.length;

  return (
    <>
      <p className="mt-6 text-xs text-muted-foreground">
        نحو {total.toLocaleString("ar-EG")} نتيجة على الويب عن «{query}»
      </p>
      <ul className="mt-3 space-y-3">
        {results.map((r) => (
          <WebResultCard key={r.id} result={r} query={query} />
        ))}
      </ul>

      <div ref={sentinel} className="h-px" aria-hidden="true" />

      {isFetchingNextPage && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> جارٍ تحميل المزيد…
        </div>
      )}

      {hasNextPage && !isFetchingNextPage && (
        <div className="mt-5 flex justify-center">
          <button
            onClick={() => void fetchNextPage()}
            className="rounded-xl border border-border px-5 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary"
          >
            عرض المزيد من النتائج
          </button>
        </div>
      )}
    </>
  );
}
