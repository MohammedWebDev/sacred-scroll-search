const KEY = "raqeem-stats";

export type Stats = {
  visits: number;
  searches: number;
  results: number;
  firstSeen: number;
};

const EMPTY: Stats = { visits: 0, searches: 0, results: 0, firstSeen: Date.now() };

export function readStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Stats>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function bumpStats(patch: Partial<Omit<Stats, "firstSeen">>): Stats {
  const cur = readStats();
  const next: Stats = {
    ...cur,
    visits: cur.visits + (patch.visits ?? 0),
    searches: cur.searches + (patch.searches ?? 0),
    results: cur.results + (patch.results ?? 0),
    firstSeen: cur.firstSeen || Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/** static library size shown alongside the usage counters */
export const LIBRARY = {
  ayat: 6236,
  suwar: 114,
  books: 8,
};
