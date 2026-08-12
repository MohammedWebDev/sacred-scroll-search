// Local favorites store (localStorage), safe on the server.
export type Bookmark = {
  id: string;
  title: string;
  url: string;
  snippet?: string;
  source?: string;
  savedAt: number;
};

const KEY = "raqeem.bookmarks.v1";
const listeners = new Set<() => void>();

function read(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    return [];
  }
}

function write(items: Bookmark[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(0, 500)));
  } catch {
    /* quota */
  }
  listeners.forEach((l) => l());
}

export const getBookmarks = read;

export function isBookmarked(id: string) {
  return read().some((b) => b.id === id);
}

/** Adds or removes; returns true when the item ends up saved. */
export function toggleBookmark(item: Omit<Bookmark, "savedAt">): boolean {
  const items = read();
  const existing = items.findIndex((b) => b.id === item.id);
  if (existing >= 0) {
    items.splice(existing, 1);
    write(items);
    return false;
  }
  write([{ ...item, savedAt: Date.now() }, ...items]);
  return true;
}

export function subscribeBookmarks(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
