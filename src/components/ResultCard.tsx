import { Copy, Share2, ExternalLink, BookMarked, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KIND_LABEL } from "@/lib/categories";
import type { SearchResult } from "@/lib/search.functions";

const kindStyle: Record<string, string> = {
  ayah: "bg-primary/10 text-primary",
  surah: "bg-accent text-accent-foreground",
  hadith: "bg-primary/10 text-primary",
  athar: "bg-secondary text-secondary-foreground",
};

export function ResultCard({ result, query }: { result: SearchResult; query: string }) {
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
    const data = { title: result.title, text: fullText, url: result.url };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(`${fullText}\n${result.url}`);
      toast.success("تم نسخ رابط المشاركة");
    } catch {
      toast.error("تعذّرت المشاركة");
    }
  };

  const highlighted = highlight(result.snippet, query);

  return (
    <li className="group rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition hover:border-primary/60 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${kindStyle[result.kind] ?? ""}`}>
            {KIND_LABEL[result.kind] ?? result.kind}
          </span>
          <span className="text-muted-foreground">{result.title}</span>
          {result.grade && (
            <span className="rounded-full border border-primary/40 px-2 py-0.5 text-primary">
              {result.grade}
            </span>
          )}
        </div>

        <Popover>
          <PopoverTrigger
            aria-label="خيارات"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <MoreVertical className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-48 p-1" dir="rtl">
            <MenuItem icon={Copy} label="نسخ النص" onClick={copy} />
            <MenuItem icon={Share2} label="مشاركة" onClick={share} />
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition hover:bg-muted"
            >
              <ExternalLink className="size-4 text-primary" /> فتح المصدر
            </a>
            <MenuItem
              icon={BookMarked}
              label="نسخ المرجع"
              onClick={async () => {
                await navigator.clipboard.writeText(result.reference);
                toast.success("تم نسخ المرجع");
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <button
        type="button"
        onClick={copy}
        className="mt-3 block w-full cursor-pointer text-right"
        title="اضغط لنسخ النص"
      >
        <p
          className={`scripture text-foreground ${
            result.kind === "ayah" ? "text-xl sm:text-2xl" : "text-base sm:text-lg"
          }`}
        >
          {highlighted}
        </p>
      </button>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{result.reference}</span>
        <div className="flex gap-1">
          <IconBtn icon={Copy} label="نسخ" onClick={copy} />
          <IconBtn icon={Share2} label="مشاركة" onClick={share} />
        </div>
      </div>
    </li>
  );
}

function MenuItem({
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
      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition hover:bg-muted"
    >
      <Icon className="size-4 text-primary" /> {label}
    </button>
  );
}

function IconBtn({
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
      aria-label={label}
      onClick={onClick}
      className="rounded-lg p-1.5 transition hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-3.5" />
    </button>
  );
}

/** highlight query words inside the result text */
function highlight(text: string, query: string) {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, ""))
    .filter(Boolean);
  if (!words.length) return text;
  const re = new RegExp(`(${words.join("|")})`, "g");
  return text.split(re).map((part, i) =>
    words.includes(part) ? (
      <mark key={i} className="rounded bg-primary/20 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
