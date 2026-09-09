/**
 * Unified Arabic matching + relevance scoring used by every search section.
 * Pure and isomorphic: no I/O, safe to import anywhere.
 */

const AR_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

/** strip diacritics / tatweel, unify hamza forms, arabic digits, punctuation */
export const normalize = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => AR_DIGITS[d] ?? d)
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    // «عبدالله» ≈ «عبد الله» ، «عبدالرحمن» ≈ «عبد الرحمن»
    .replace(/عبدال/g, "عبد ال")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** light Arabic stemmer: drop common prefixes/suffixes so «الصبر» ≈ «صبر» */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5) w = w.replace(/^(?:وال|فال|بال|كال|لل)/, "");
  if (w.length > 4) w = w.replace(/^(?:ال|وا|فا)/, "");
  if (w.length > 4) w = w.replace(/^[وفبكل]/, "");
  if (w.length > 5) w = w.replace(/(?:ات|ون|ين|ان|هما|كما|هم|هن|كم|نا|ها|ه|ي|ك)$/, "");
  return w;
}

export const STOP = new Set([
  "سوره", "ايه", "الايه", "الايات", "ايات", "حديث", "الحديث", "احاديث", "اثر", "الاثر", "الاثار",
  "في", "من", "عن", "علي", "الي", "ما", "هو", "هي", "قول", "اقوال", "مقولات", "اقول",
  "كلام", "قصه", "قصص", "حول", "عند", "باب", "رقم", "كتاب", "ال", "بن", "ابن",
  "the", "of", "and", "a",
]);


export type PreparedQuery = {
  raw: string;
  norm: string;
  tokens: string[];
  stems: string[];
};

export function prepareQuery(query: string): PreparedQuery {
  const norm = normalize(query);
  const tokens = norm.split(" ").filter((w) => w.length > 1 && !STOP.has(w));
  return { raw: query, norm, tokens, stems: tokens.map(stem) };
}

/** distance-1 check (fast, early-exit) */
function nearlyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (Math.min(a.length, b.length) < 4) return false;
  let i = 0;
  let j = 0;
  let diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++diff > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

/** 0 = no match, otherwise a normalized 0..100 relevance score */
export function scoreText(text: string, q: PreparedQuery): number {
  if (!q.tokens.length) return 0;
  const n = normalize(text);
  if (!n) return 0;
  const words = n.split(" ");
  const wordStems = words.map(stem);
  const stemSet = new Set(wordStems);
  const wordSet = new Set(words);

  let hitSum = 0;
  let fullHits = 0;
  for (let k = 0; k < q.tokens.length; k++) {
    const t = q.tokens[k]!;
    const st = q.stems[k]!;
    if (wordSet.has(t) || stemSet.has(st)) {
      hitSum += 1;
      fullHits += 1;
      continue;
    }
    let partial = 0;
    for (const w of wordStems) {
      if (w.length >= 3 && (w.startsWith(st) || st.startsWith(w))) {
        partial = Math.max(partial, 0.7);
        break;
      }
      if (nearlyEqual(w, st)) partial = Math.max(partial, 0.55);
    }
    hitSum += partial;
  }

  const coverage = hitSum / q.tokens.length;
  if (coverage <= 0) return 0;
  // a multi-word query must really be answered by the text, not by one fuzzy echo
  if (q.tokens.length > 1) {
    if (fullHits === 0) return 0;
    if (coverage < 0.55) return 0;
  } else if (fullHits === 0 && coverage < 0.7) {
    return 0;
  }

  let score = coverage * 62;
  if (q.norm.length > 2 && n.includes(q.norm)) {
    // full-phrase match: the richer passage answers better than a bare fragment
    score += 24 + Math.min(6, n.length / 60);
  } else {
    if (q.tokens.length > 1 && inOrder(words, q.stems, wordStems)) score += 9;
    // shorter texts answer the question faster
    score += Math.max(0, 7 - n.length / 260);
  }
  return Math.min(100, Math.round(score * 10) / 10);
}

/** name words shared by hundreds of people — never identifying on their own */
const COMMON_NAME_WORDS = new Set([
  "عبد", "الله", "ابو", "ابي", "ام", "بنت", "الدين", "محمد", "احمد", "علي", "عبدالله",
]);

/**
 * How well a proper name (speaker, author, book) answers the query.
 * Returns 0..1. The distinctive part of the name («المبارك»، «الثوري») must be
 * present, otherwise «عبد الله بن مسعود» would answer «عبد الله بن المبارك».
 */
export function nameMatch(name: string, q: PreparedQuery): number {
  const parts = normalize(name)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
  if (!parts.length || !q.tokens.length) return 0;
  const qSet = new Set([...q.tokens, ...q.stems]);
  const has = (p: string) => qSet.has(p) || qSet.has(stem(p));

  let hits = 0;
  for (const p of parts) if (has(p)) hits += 1;
  if (!hits) return 0;

  const distinctive = parts.filter((p) => !COMMON_NAME_WORDS.has(p));
  // every distinctive word of the name must be named by the query
  if (distinctive.length) {
    const distinctiveHits = distinctive.filter(has).length;
    if (distinctiveHits === 0) return 0;
    if (distinctiveHits < distinctive.length) return 0.3 * (distinctiveHits / distinctive.length);
    return Math.max(0.8, hits / parts.length);
  }
  return hits === parts.length ? 0.8 : 0.3;
}



function inOrder(words: string[], qStems: string[], wordStems: string[]): boolean {
  let idx = 0;
  for (const st of qStems) {
    let found = -1;
    for (let i = idx; i < wordStems.length; i++) {
      if (wordStems[i] === st || words[i] === st) {
        found = i;
        break;
      }
    }
    if (found === -1) return false;
    idx = found + 1;
  }
  return true;
}

/** keeps only the best N items without sorting the whole corpus */
export class TopK<T> {
  private items: { v: T; s: number }[] = [];
  constructor(private readonly k: number) {}
  push(v: T, s: number) {
    this.items.push({ v, s });
    if (this.items.length > this.k * 3) this.trim();
  }
  private trim() {
    this.items.sort((a, b) => b.s - a.s);
    this.items.length = Math.min(this.items.length, this.k);
  }
  values(): T[] {
    this.trim();
    return this.items.map((i) => i.v);
  }
  get size() {
    return this.items.length;
  }
}
