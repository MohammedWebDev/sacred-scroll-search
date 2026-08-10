import { useState } from "react";
import { Copy, Share2, ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";
import { highlightText } from "@/lib/highlight";
import type { WebResult } from "@/lib/google.functions";

export function WebResultCard({ result, query }: { result: WebResult; query: string }) {
  const [iconFailed, setIconFailed] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(result.link);
      toast.success("تم نسخ الرابط");
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const share = async () => {
    const data = { title: result.title, text: result.snippet, url: result.link };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* cancelled */
      }
    }
    await copyLink();
  };

  return (
    <li className="group rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition hover:border-primary/60">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {result.favicon && !iconFailed ? (
            <img
              src={result.favicon}
              alt=""
              aria-hidden="true"
              loading="lazy"
              width={20}
              height={20}
              className="size-5"
              onError={() => setIconFailed(true)}
            />
          ) : (
            <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">
              {result.siteName ?? result.displayLink}
            </span>
            <span dir="ltr" className="truncate text-[11px] opacity-80">
              {result.formattedUrl}
            </span>
          </div>

          <a
            href={result.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-base font-semibold leading-snug text-primary underline-offset-4 hover:underline sm:text-lg"
          >
            {highlightText(result.title, query)}
          </a>

          {result.snippet && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {highlightText(result.snippet, query)}
            </p>
          )}

          <div className="mt-3 flex items-center gap-1 text-muted-foreground">
            <Action icon={ExternalLink} label="فتح" onClick={() => window.open(result.link, "_blank", "noopener")} />
            <Action icon={Copy} label="نسخ الرابط" onClick={copyLink} />
            <Action icon={Share2} label="مشاركة" onClick={share} />
          </div>
        </div>

        {result.thumbnail && (
          <img
            src={result.thumbnail}
            alt=""
            aria-hidden="true"
            loading="lazy"
            className="hidden size-20 shrink-0 rounded-xl object-cover sm:block"
          />
        )}
      </div>
    </li>
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
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-3.5" aria-hidden="true" /> {label}
    </button>
  );
}

export function WebResultSkeleton() {
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </li>
  );
}
