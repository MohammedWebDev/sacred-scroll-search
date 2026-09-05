import { Copy, Share2, ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { KIND_LABEL } from "@/lib/categories";
import type { SearchResult } from "@/lib/search.functions";
import { highlightText } from "@/lib/highlight";

/** The single strongest match, shown big at the top of the results page. */
export function AnswerCard({ result, query }: { result: SearchResult; query: string }) {
  const fullText = `${result.snippet}\n${result.reference}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      toast.success("تم نسخ النص");
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const share = async () => {
    const payload = { title: result.title, text: fullText, url: result.url };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(`${fullText}\n${result.url}`);
    toast.success("تم نسخ رابط المشاركة");
  };

  return (
    <section
      aria-label="أفضل نتيجة"
      className="mt-5 rounded-2xl border border-primary/40 bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-semibold text-primary-foreground">
          <Sparkles className="size-3" /> أفضل نتيجة
        </span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
          {KIND_LABEL[result.kind] ?? result.kind}
        </span>
        <span className="text-muted-foreground">{result.title}</span>
        {result.grade && (
          <span className="rounded-full border border-primary/40 px-2 py-0.5 text-primary">
            {result.grade}
          </span>
        )}
      </div>

      <p className="scripture mt-4 text-xl leading-loose text-foreground sm:text-2xl">
        {highlightText(result.snippet, query)}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{result.reference}</span>
        <div className="flex flex-wrap gap-2">
          <Action icon={Copy} label="نسخ" onClick={copy} />
          <Action icon={Share2} label="مشاركة" onClick={share} />
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-primary hover:text-primary"
          >
            <ExternalLink className="size-3.5" /> المصدر
          </a>
        </div>
      </div>
    </section>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-primary hover:text-primary"
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}
