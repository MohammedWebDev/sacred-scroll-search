import { useEffect, useState } from "react";
import { X, ExternalLink, RotateCw, Copy, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export type ReaderTarget = { url: string; title?: string } | null;

/** Slide-over in-app reader: renders the target page in an embedded frame. */
export function InAppReader({ target, onClose }: { target: ReaderTarget; onClose: () => void }) {
  const [nonce, setNonce] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!target) return;
    setBlocked(false);
    setNonce((n) => n + 1);
    const timer = setTimeout(() => setBlocked(true), 6000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [target, onClose]);

  if (!target) return null;

  let host = target.url;
  try {
    host = new URL(target.url).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="عارض الصفحة">
      <button
        type="button"
        aria-label="إغلاق العارض"
        onClick={onClose}
        className="flex-1 bg-foreground/40 backdrop-blur-sm"
      />
      <aside className="flex h-full w-full max-w-3xl flex-col border-s border-border bg-background shadow-2xl">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted"
          >
            <X className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{target.title ?? host}</p>
            <p dir="ltr" className="truncate text-[11px] text-muted-foreground">
              {target.url}
            </p>
          </div>
          <IconBtn label="تحديث" icon={RotateCw} onClick={() => { setBlocked(false); setNonce((n) => n + 1); }} />
          <IconBtn
            label="نسخ الرابط"
            icon={Copy}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(target.url);
                toast.success("تم نسخ الرابط");
              } catch {
                toast.error("تعذّر النسخ");
              }
            }}
          />
          <IconBtn
            label="فتح في تبويب جديد"
            icon={ExternalLink}
            onClick={() => window.open(target.url, "_blank", "noopener,noreferrer")}
          />
        </header>

        <div className="relative flex-1 bg-muted/30">
          <iframe
            key={nonce}
            src={target.url}
            title={target.title ?? host}
            onLoad={() => setBlocked(false)}
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            className="size-full border-0 bg-background"
          />
          {blocked && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
              <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border bg-card/95 p-3 text-xs text-muted-foreground backdrop-blur">
                <ShieldAlert className="size-4 shrink-0 text-primary" />
                <span className="flex-1">
                  بعض المواقع تمنع العرض داخل التطبيق. يمكنك فتحها في تبويب جديد.
                </span>
                <button
                  type="button"
                  onClick={() => window.open(target.url, "_blank", "noopener,noreferrer")}
                  className="rounded-lg bg-primary px-2.5 py-1 font-semibold text-primary-foreground"
                >
                  فتح
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function IconBtn({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Copy;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  );
}
