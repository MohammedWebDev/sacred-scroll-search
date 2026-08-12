import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Copy, Share2, Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getAyah } from "@/lib/ayah.functions";
import type { QuranRef } from "@/lib/quranParser";
import { useBookmark } from "@/lib/useBookmark";

export function AyahCard({ reference, onOpen }: { reference: QuranRef; onOpen: (url: string, title: string) => void }) {
  const run = useServerFn(getAyah);
  const { data, isLoading } = useQuery({
    queryKey: ["ayah", reference.surah, reference.ayah ?? 0],
    queryFn: () => run({ data: { surah: reference.surah, ...(reference.ayah ? { ayah: reference.ayah } : {}) } }),
    staleTime: 60 * 60 * 1000,
  });

  const title = data?.ayah
    ? `سورة ${data.surahName} — الآية ${data.ayah}`
    : `سورة ${data?.surahName ?? reference.surahName}`;
  const url = data?.url ?? `https://quran.com/${reference.surah}`;

  const { saved, toggle } = useBookmark({
    id: `ayah:${reference.surah}:${reference.ayah ?? 0}`,
    title,
    url,
    ...(data?.text ? { snippet: data.text } : {}),
    source: "القرآن الكريم",
  });

  const fullText = `${data?.text ?? ""}\n${title}\n${url}`;

  if (isLoading) {
    return (
      <div className="mt-4 h-40 animate-pulse rounded-2xl border border-primary/30 bg-card" />
    );
  }
  if (!data || data.error) return null;

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-primary/40 bg-card shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/10 px-4 py-2 text-xs">
        <BookOpen className="size-4 text-primary" />
        <span className="font-semibold text-primary">بطاقة قرآنية</span>
        <span className="text-muted-foreground">{title}</span>
        {data.revelation && (
          <span className="rounded-full border border-primary/40 px-2 py-0.5 text-primary">
            {data.revelation}
          </span>
        )}
        {data.numberOfAyahs && (
          <span className="text-muted-foreground">عدد آياتها {data.numberOfAyahs}</span>
        )}
      </div>

      <div className="px-4 py-5">
        <p className="font-quran text-xl leading-loose text-foreground sm:text-2xl">{data.text}</p>
        {data.tafsir && (
          <p className="mt-4 rounded-xl bg-muted/60 p-3 text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">التفسير الميسّر: </span>
            {data.tafsir}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-1 text-muted-foreground">
          <Act
            icon={Copy}
            label="نسخ"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fullText);
                toast.success("تم نسخ الآية");
              } catch {
                toast.error("تعذّر النسخ");
              }
            }}
          />
          <Act
            icon={Share2}
            label="مشاركة"
            onClick={async () => {
              if (navigator.share) {
                try {
                  await navigator.share({ title, text: data.text ?? title, url });
                  return;
                } catch {
                  /* cancelled */
                }
              }
              await navigator.clipboard.writeText(`${fullText}`);
              toast.success("تم نسخ نص المشاركة");
            }}
          />
          <Act
            icon={saved ? BookmarkCheck : Bookmark}
            label={saved ? "محفوظة" : "حفظ"}
            active={saved}
            onClick={toggle}
          />
          <Act icon={ExternalLink} label="قراءة" onClick={() => onOpen(url, title)} />
        </div>
      </div>
    </section>
  );
}

function Act({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition hover:bg-muted hover:text-foreground ${
        active ? "text-primary" : ""
      }`}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}
