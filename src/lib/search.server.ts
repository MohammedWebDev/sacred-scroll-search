import { prepareQuery, normalize, scoreText, TopK, type PreparedQuery } from "@/lib/relevance";
import { parseIntent, detectBook } from "@/lib/query-intent";

export type ResultKind = "ayah" | "surah" | "hadith" | "athar";

export type SearchResult = {
  id: string;
  kind: ResultKind;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  reference: string;
  grade?: string;
  score: number;
};

/* ---------------- Quran metadata ---------------- */

type SurahMeta = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
};

let surahCache: SurahMeta[] | null = null;

export async function getSurahs(): Promise<SurahMeta[]> {
  if (surahCache) return surahCache;
  const res = await fetch("https://api.alquran.cloud/v1/surah");
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: SurahMeta[] };
  surahCache = json.data ?? [];
  return surahCache;
}

const surahClean = (name: string) => normalize(name).replace(/^سوره\s*/, "");

async function matchSurahs(query: string) {
  const list = await getSurahs();
  const q = normalize(query).replace(/^سوره\s*/, "").trim();
  if (!q) return [] as { s: SurahMeta; score: number }[];
  const out: { s: SurahMeta; score: number }[] = [];
  for (const s of list) {
    const name = surahClean(s.name);
    const bare = name.replace(/^ال/, "");
    const en = s.englishName.toLowerCase().replace(/[^a-z]/g, "");
    const qBare = q.replace(/^ال/, "");
    const qEn = q.replace(/[^a-z]/g, "");
    let score = 0;
    if (String(s.number) === q) score = 100;
    else if (name === q || bare === qBare) score = 98;
    else if (name.startsWith(q) || bare.startsWith(qBare)) score = 88;
    else if (q.includes(name) || q.includes(bare)) score = 80;
    else if (name.includes(q) && q.length > 2) score = 70;
    else if (qEn.length > 2 && (en === qEn || en.startsWith(qEn))) score = 75;
    if (score) out.push({ s, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

type Ayah = { number: number; text: string; numberInSurah: number };

const ayahCache = new Map<number, Ayah[]>();

async function getSurahAyahs(num: number): Promise<Ayah[]> {
  const cached = ayahCache.get(num);
  if (cached) return cached;
  const res = await fetch(`https://api.alquran.cloud/v1/surah/${num}/quran-uthmani`);
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { ayahs?: Ayah[] } };
  const ayahs = json.data?.ayahs ?? [];
  ayahCache.set(num, ayahs);
  return ayahs;
}

/** removes replacement chars / control chars that leak from upstream datasets */
export function sanitizeText(t: string) {
  return t
    .replace(/[\uFFFD\u0000-\u001F\u200B-\u200F\u202A-\u202E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** well-known ayah nicknames people search by name, not by text */
const FAMOUS_AYAT: { keys: string[]; surah: number; from: number; to?: number }[] = [
  { keys: ["ايه الكرسي", "ايت الكرسي", "الكرسي"], surah: 2, from: 255 },
  { keys: ["ايه الدين", "ايت الدين", "اطول ايه"], surah: 2, from: 282 },
  { keys: ["خواتيم البقره", "اواخر البقره"], surah: 2, from: 285, to: 286 },
  { keys: ["ايه النور"], surah: 24, from: 35 },
  { keys: ["ايه المباهله"], surah: 3, from: 61 },
  { keys: ["ايه الميراث"], surah: 4, from: 11 },
  { keys: ["ايه التطهير"], surah: 33, from: 33 },
  { keys: ["ايه الوضوء"], surah: 5, from: 6 },
  { keys: ["ايه الامانه"], surah: 4, from: 58 },
  { keys: ["ايه الصيام"], surah: 2, from: 183 },
  { keys: ["ايه الحجاب"], surah: 33, from: 59 },
  { keys: ["ايه الكلاله"], surah: 4, from: 176 },
  { keys: ["ايه الرباء", "ايه الربا"], surah: 2, from: 275 },
];

function matchFamousAyah(query: string) {
  const n = normalize(query);
  for (const f of FAMOUS_AYAT) if (f.keys.some((k) => n.includes(k))) return f;
  return null;
}

function ayahResult(s: SurahMeta, a: Ayah, score: number): SearchResult {
  const clean = s.name.replace(/^سُورَةُ\s*/, "");
  return {
    id: `ayah-${s.number}-${a.numberInSurah}`,
    kind: "ayah",
    title: `${clean} — الآية ${a.numberInSurah}`,
    url: `https://quran.com/${s.number}/${a.numberInSurah}`,
    snippet: sanitizeText(a.text),
    domain: "القرآن الكريم",
    reference: `[${clean}: ${a.numberInSurah}]`,
    score,
  };
}

function surahResult(s: SurahMeta, score: number): SearchResult {
  return {
    id: `surah-${s.number}`,
    kind: "surah",
    title: `${s.name} (${s.englishName})`,
    url: `https://quran.com/${s.number}`,
    snippet: `السورة رقم ${s.number} — عدد آياتها ${s.numberOfAyahs} — ${
      s.revelationType === "Meccan" ? "مكية" : "مدنية"
    } — ${s.englishNameTranslation}`,
    domain: "فهرس السور",
    reference: `سورة رقم ${s.number}`,
    score,
  };
}

/* ---------------- Quran search ---------------- */

async function searchQuranRemote(query: string, q: PreparedQuery): Promise<SearchResult[]> {
  const list = await getSurahs();
  const byNumber = new Map(list.map((s) => [s.number, s]));
  const res = await fetch(
    `https://api.alquran.cloud/v1/search/${encodeURIComponent(normalize(query))}/all/quran-simple`,
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: { matches?: { text: string; numberInSurah: number; surah: { number: number } }[] };
  };
  const out: SearchResult[] = [];
  for (const m of json.data?.matches ?? []) {
    const s = byNumber.get(m.surah.number);
    if (!s) continue;
    const rel = scoreText(m.text, q);
    out.push(
      ayahResult(s, { number: 0, text: m.text, numberInSurah: m.numberInSurah }, Math.max(45, rel)),
    );
  }
  return out;
}

/** local scan over already-cached surahs — used when the remote search is weak */
function searchQuranLocal(q: PreparedQuery, list: SurahMeta[]): SearchResult[] {
  const top = new TopK<SearchResult>(30);
  const byNumber = new Map(list.map((s) => [s.number, s]));
  for (const [num, ayahs] of ayahCache) {
    const s = byNumber.get(num);
    if (!s) continue;
    for (const a of ayahs) {
      const sc = scoreText(a.text, q);
      if (sc > 20) top.push(ayahResult(s, a, sc), sc);
    }
  }
  return top.values();
}

export async function searchQuran(query: string): Promise<SearchResult[]> {
  const q = prepareQuery(query);
  const intent = parseIntent(query);
  const out = new Map<string, SearchResult>();
  const add = (r: SearchResult) => {
    const prev = out.get(r.id);
    if (!prev || prev.score < r.score) out.set(r.id, r);
  };

  const list = await getSurahs();

  // 0) famous ayah nicknames ("آية الكرسي", "خواتيم البقرة", …)
  const famous = matchFamousAyah(query);
  if (famous) {
    const s = list.find((x) => x.number === famous.surah);
    if (s) {
      const ayahs = await getSurahAyahs(s.number);
      const to = famous.to ?? famous.from;
      for (const a of ayahs) {
        if (a.numberInSurah >= famous.from && a.numberInSurah <= to) add(ayahResult(s, a, 100));
        else if (Math.abs(a.numberInSurah - famous.from) <= 2) add(ayahResult(s, a, 88));
      }
      add(surahResult(s, 70));
    }
  }

  // 1) explicit ayah reference: "2:255" or "البقرة 255"
  let refSurah: SurahMeta | undefined;
  let refAyah: number | undefined;
  if (intent.pair) {
    refSurah = list.find((s) => s.number === intent.pair!.first);
    refAyah = intent.pair.second;
  } else if (intent.number && intent.text) {
    const m = await matchSurahs(intent.text);
    if (m[0]) {
      refSurah = m[0].s;
      refAyah = intent.number;
    }
  }
  if (refSurah && refAyah) {
    const ayahs = await getSurahAyahs(refSurah.number);
    const exact = ayahs.find((a) => a.numberInSurah === refAyah);
    if (exact) add(ayahResult(refSurah, exact, 100));
    for (const a of ayahs) {
      const d = Math.abs(a.numberInSurah - refAyah);
      if (d > 0 && d <= 2) add(ayahResult(refSurah, a, 92 - d));
    }
  }

  // 2) surah name / number
  const nameMatches = await matchSurahs(intent.text || query);
  for (const { s, score } of nameMatches.slice(0, 2)) {
    if (!refAyah) {
      add(surahResult(s, Math.min(97, score)));
      const ayahs = await getSurahAyahs(s.number);
      ayahs.slice(0, 10).forEach((a, i) => add(ayahResult(s, a, Math.max(50, score - 10 - i))));
    }
  }

  // 3) content search
  if (q.tokens.length) {
    const remote = await searchQuranRemote(query, q).catch(() => []);
    for (const r of remote) add(r);
    if (remote.length < 3) for (const r of searchQuranLocal(q, list)) add(r);
  }

  return [...out.values()].sort((a, b) => b.score - a.score).slice(0, 60);
}

export async function searchSurahs(query: string): Promise<SearchResult[]> {
  const list = await getSurahs();
  if (!normalize(query)) return list.map((s) => surahResult(s, 60));
  const q = prepareQuery(query);
  const matches = await matchSurahs(query);
  const results = matches.map(({ s, score }) => surahResult(s, score));
  const seen = new Set(results.map((r) => r.id));
  if (results.length < 8 && q.tokens.length) {
    for (const r of await searchQuranRemote(query, q).catch(() => [])) {
      const num = Number(r.id.split("-")[1]);
      const s = list.find((x) => x.number === num);
      if (s && !seen.has(`surah-${num}`)) {
        seen.add(`surah-${num}`);
        results.push(surahResult(s, Math.min(65, r.score)));
      }
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 40);
}

/* ---------------- Hadith / Athar ---------------- */

type HadithEntry = {
  hadithnumber: number;
  arabicnumber?: number;
  text: string;
  grades?: { name: string; grade: string }[];
  reference?: { book: number; hadith: number };
};

type HadithEdition = { hadiths: HadithEntry[] };

export const HADITH_BOOKS = [
  { id: "bukhari", name: "صحيح البخاري", aliases: ["البخاري", "بخاري"] },
  { id: "muslim", name: "صحيح مسلم", aliases: ["مسلم"] },
  { id: "abudawud", name: "سنن أبي داود", aliases: ["ابو داود", "ابي داود", "داود"] },
  { id: "tirmidhi", name: "سنن الترمذي", aliases: ["الترمذي", "ترمذي"] },
  { id: "nasai", name: "سنن النسائي", aliases: ["النسائي", "نسائي"] },
  { id: "ibnmajah", name: "سنن ابن ماجه", aliases: ["ابن ماجه", "ماجه"] },
  { id: "nawawi", name: "الأربعون النووية", aliases: ["النووية", "الاربعون"] },
];

export const ATHAR_BOOKS = [
  { id: "malik", name: "موطأ مالك", aliases: ["الموطا", "مالك"] },
  { id: "bukhari", name: "صحيح البخاري", aliases: ["البخاري"] },
  { id: "muslim", name: "صحيح مسلم", aliases: ["مسلم"] },
  { id: "abudawud", name: "سنن أبي داود", aliases: ["ابو داود"] },
];

const NAME_BY_ID = new Map([...HADITH_BOOKS, ...ATHAR_BOOKS].map((b) => [b.id, b.name] as const));

const bookCache = new Map<string, HadithEdition | null>();

async function getBook(id: string) {
  if (bookCache.has(id)) return bookCache.get(id) ?? null;
  let data: HadithEdition | null = null;
  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${id}.min.json`,
    );
    if (res.ok) data = (await res.json()) as HadithEdition;
  } catch {
    data = null;
  }
  bookCache.set(id, data);
  return data;
}

function hadithResult(
  bookId: string,
  h: HadithEntry,
  kind: ResultKind,
  score: number,
): SearchResult {
  const name = NAME_BY_ID.get(bookId) ?? bookId;
  const grade = h.grades?.find((g) => g.grade)?.grade;
  const text = h.text.replace(/\s+/g, " ").trim();
  return {
    id: `${kind}-${bookId}-${h.hadithnumber}`,
    kind,
    title: `${name} — رقم ${h.hadithnumber}`,
    url: `https://sunnah.com/${bookId}:${h.hadithnumber}`,
    snippet: text.length > 700 ? `${text.slice(0, 700)}…` : text,
    domain: name,
    reference: `${name} (${h.hadithnumber})`,
    ...(grade ? { grade } : {}),
    score,
  };
}

const PROPHET_MARKERS = [
  "قال رسول الله",
  "قال النبي",
  "سمعت رسول الله",
  "سمعت النبي",
  "ان رسول الله",
  "ان النبي",
  "يقول رسول الله",
];

const SAID_BY = /(?:قال|كان|سيل|سئل|عن)\s+([\u0600-\u06FF\s]{3,40}?)\s*(?:رضي الله عنه|رحمه الله)?\s*[:،]?/;

import { ATHAR_NARRATORS } from "@/lib/query-intent";

/** true when the text is a saying of a companion / successor, not a prophetic hadith */
function isAthar(normText: string) {
  const narrator = ATHAR_NARRATORS.find((x) => normText.includes(x));
  if (!narrator) return false;
  const marfu = PROPHET_MARKERS.some((m) => normText.includes(normalize(m)));
  if (!marfu) return true;
  // marfu' chain: only an athar when the narrator's own words are quoted too
  const idx = normText.indexOf(narrator);
  const after = normText.slice(idx);
  return /(?:قال|كان)\s/.test(after) && !PROPHET_MARKERS.some((m) => after.startsWith(normalize(m)));
}

async function searchCollection(
  query: string,
  bookIds: string[],
  kind: ResultKind,
  onlyAthar: boolean,
): Promise<SearchResult[]> {
  const q = prepareQuery(query);
  const intent = parseIntent(query);
  const catalog = onlyAthar ? ATHAR_BOOKS : HADITH_BOOKS;
  const books = catalog.filter((b) => !bookIds.length || bookIds.includes(b.id));
  const requestedBook = detectBook(query, catalog);
  const top = new TopK<SearchResult>(60);
  const exacts: SearchResult[] = [];

  await Promise.all(
    books.map(async (book) => {
      const data = await getBook(book.id);
      if (!data) return;

      // explicit "<book> <number>" reference
      if (intent.number && (!requestedBook || requestedBook === book.id)) {
        const exact = data.hadiths.find((h) => h.hadithnumber === intent.number);
        if (exact) {
          const n = normalize(exact.text);
          if (!onlyAthar || isAthar(n)) exacts.push(hadithResult(book.id, exact, kind, 100));
        }
      }

      if (!q.tokens.length) return;
      const bookBoost = requestedBook === book.id ? 6 : 0;
      for (const h of data.hadiths) {
        const n = normalize(h.text);
        if (onlyAthar && !isAthar(n)) continue;
        let s = scoreText(h.text, q);
        // person query: strongly favour texts whose chain names that person
        if (intent.person && n.includes(intent.person)) s = Math.max(s, 72) + 8;
        if (s <= 18) continue;
        s = Math.min(99, s + bookBoost);
        top.push(hadithResult(book.id, h, kind, s), s);
      }
    }),
  );

  const seen = new Set<string>();
  return [...exacts, ...top.values()]
    .sort((a, b) => b.score - a.score)
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .slice(0, 60);
}

export const searchHadith = (query: string, bookIds?: string[]) =>
  searchCollection(query, bookIds ?? [], "hadith", false);

export const searchAthar = (query: string, bookIds?: string[]) =>
  searchCollection(query, bookIds ?? [], "athar", true);

/* ---------------- unified (smart) search ---------------- */

export async function searchAll(query: string): Promise<SearchResult[]> {
  const intent = parseIntent(query);
  const [quran, hadith, athar] = await Promise.all([
    searchQuran(query).catch(() => []),
    searchHadith(query).catch(() => []),
    intent.person || !intent.numberOnly ? searchAthar(query).catch(() => []) : Promise.resolve([]),
  ]);

  // an exact ayah reference must not be tied with hadiths sharing that number
  const exactAyah = quran.some((r) => r.score >= 100);
  const adjust = (r: SearchResult) =>
    exactAyah && r.score >= 100 ? { ...r, score: 80 } : r;

  return [...quran.slice(0, 25), ...hadith.slice(0, 25).map(adjust), ...athar.slice(0, 20).map(adjust)].sort(
    (a, b) => b.score - a.score,
  );
}
