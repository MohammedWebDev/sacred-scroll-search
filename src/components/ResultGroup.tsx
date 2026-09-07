import { KIND_LABEL } from "@/lib/categories";
import { ResultCard } from "@/components/ResultCard";
import type { SearchResult } from "@/lib/search.functions";

/** A titled group of results (Ayat / Surahs / Hadith / Athar) with a counter. */
export function ResultGroup({
  kind,
  results,
  query,
}: {
  kind: string;
  results: SearchResult[];
  query: string;
}) {
  if (results.length === 0) return null;
  return (
    <section id={`group-${kind}`} className="mt-6 scroll-mt-32">
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
        {KIND_LABEL[kind] ?? kind}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
          {results.length}
        </span>
      </h2>
      <ul className="mt-3 space-y-3">
        {results.map((r) => (
          <ResultCard key={r.id} result={r} query={query} />
        ))}
      </ul>
    </section>
  );
}
