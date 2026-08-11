import { useEffect, useRef, useState } from "react";
import { Search, Globe } from "lucide-react";
import { SearchSuggestions } from "@/components/SearchSuggestions";

/** Detects a bare domain or full URL typed into the omnibox. */
export function parseOmniboxInput(raw: string): { kind: "url"; url: string } | { kind: "query"; query: string } {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return { kind: "query", query: value };

  if (/^https?:\/\/[^\s]+\.[^\s]{2,}/i.test(value)) return { kind: "url", url: value };

  // bare domain: example.com, sub.example.co.uk/path
  if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?(?:\/\S*)?$/i.test(value)) {
    return { kind: "url", url: `https://${value.replace(/^www\./i, "www.")}` };
  }

  return { kind: "query", query: value };
}

export function Omnibox({
  value,
  onChange,
  onSearch,
  className = "",
}: {
  value: string;
  onChange: (next: string) => void;
  onSearch: (query: string) => void;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  const parsed = parseOmniboxInput(value);
  const isUrl = parsed.kind === "url";

  const submit = () => {
    setFocused(false);
    const result = parseOmniboxInput(value);
    if (result.kind === "url") {
      window.open(result.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (result.query) onSearch(result.query);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      role="search"
      className={`relative flex flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 ${className}`}
    >
      {isUrl ? (
        <Globe className="size-4 shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setFocused(false), 120);
        }}
        aria-label="ابحث أو اكتب عنوان موقع"
        placeholder="ابحث أو اكتب عنوان موقع"
        autoComplete="off"
        dir="auto"
        className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
      />
      <button
        type="submit"
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        {isUrl ? "فتح" : "بحث"}
      </button>

      {focused && !isUrl && value.trim().length >= 2 && (
        <SearchSuggestions
          term={value}
          onPick={(picked) => {
            onChange(picked);
            setFocused(false);
            onSearch(picked);
          }}
        />
      )}
    </form>
  );
}
