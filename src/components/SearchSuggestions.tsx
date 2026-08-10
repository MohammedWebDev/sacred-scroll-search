import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { querySuggestions } from "@/lib/google.functions";

/** Debounced autocomplete list rendered under the search field. */
export function SearchSuggestions({
  term,
  onPick,
}: {
  term: string;
  onPick: (value: string) => void;
}) {
  const suggest = useServerFn(querySuggestions);
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 250);
    return () => clearTimeout(id);
  }, [term]);

  const { data } = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () => suggest({ data: { query: debounced } }),
    enabled: debounced.length >= 2,
    staleTime: 10 * 60 * 1000,
  });

  const items = (data?.suggestions ?? []).filter((s) => s !== term).slice(0, 6);
  if (!items.length) return null;

  return (
    <ul
      role="listbox"
      aria-label="اقتراحات البحث"
      className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-[var(--shadow-soft)]"
    >
      {items.map((s) => (
        <li key={s}>
          <button
            type="button"
            role="option"
            aria-selected="false"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(s)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm transition hover:bg-muted"
          >
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{s}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
