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

/* ---------------- helpers ---------------- */

const AR_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

export const normalize = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => AR_DIGITS[d] ?? d)
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP = new Set(["سوره", "سورة", "ايه", "اية", "الايه", "حديث", "الحديث", "في", "من", "عن", "باب", "رقم", "قال"]);

const tokens = (s: string) => normalize(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w));

/** relevance score of a text against query tokens (0 = no match) */
function scoreText(text: string, q: string, qTokens: string[]) {
  const n = normalize(text);
  if (!qTokens.length) return 0;
  let score = 0;
  if (q && n.includes(q)) score += 100 + Math.min(40, (q.length / Math.max(n.length, 1)) * 400);
  let hits = 0;
  for (const t of qTokens) {
    if (n.includes(t)) {
      hits++;
      score += 12;
    }
  }
  if (hits === 0) return 0;
  if (hits === qTokens.length) score += 30;
  score += Math.max(0, 10 - n.length / 200);
  return score;
}

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

/** find surahs matching a (partial) name, number or english name */
async function matchSurahs(query: string) {
  const list = await getSurahs();
  const q = normalize(query).replace(/^سوره\s*/, "").trim();
  if (!q) return [] as { s: SurahMeta; score: number }[];
  const out: { s: SurahMeta; score: number }[] = [];
  for (const s of list) {
    const name = surahClean(s.name);
    const en = s.englishName.toLowerCase();
    let score = 0;
    if (String(s.number) === q) score = 200;
    else if (name === q) score = 190;
    else if (name.startsWith(q) || q.startsWith(name)) score = 160;
    else if (name.includes(q) || q.includes(name)) score = 120;
    else if (en === q.toLowerCase() || en.includes(q.toLowerCase())) score = 110;
    if (score) out.push({ s, score });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** parse things like "2:255", "البقرة 255", "سورة الكهف الآية 10" */
async function parseAyahRef(query: string) {
  const n = normalize(query);
  const colon = n.match(/(\d+)\s*[:\/]\s*(\d+)/);
  if (colon) return { surahQuery: colon[1]!, ayah: Number(colon[2]) };
  const num = n.match(/(\d+)/);
  const withoutNum = n.replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
  if (num && withoutNum) {
    const m = await matchSurahs(withoutNum);
    if (m.length) return { surahQuery: withoutNum, ayah: Number(num[1]) };
  }
  return null;
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

function ayahResult(s: SurahMeta, a: Ayah, score: number): SearchResult {
  return {
    id: `ayah-${s.number}-${a.numberInSurah}`,
    kind: "ayah",
    title: `${s.name} — الآية ${a.numberInSurah}`,
    url: `https://quran.com/${s.number}/${a.numberInSurah}`,
    snippet: a.text,
    domain: "القرآن الكريم",
    reference: `[${s.name.replace(/^سُورَةُ\s*/, "")}: ${a.numberInSurah}]`,
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

async function searchQuranText(query: string): Promise<SearchResult[]> {
  const list = await getSurahs();
  const byNumber = new Map(list.map((s) => [s.number, s]));
  const res = await fetch(
    `https://api.alquran.cloud/v1/search/${encodeURIComponent(normalize(query))}/all/quran-simple`,
  );
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: { matches?: { text: string; numberInSurah: number; surah: { number: number } }[] };
  };
  const q = normalize(query);
  const qT = tokens(query);
  const out: SearchResult[] = [];
  for (const m of json.data?.matches ?? []) {
    const s = byNumber.get(m.surah.number);
    if (!s) continue;
    out.push(
      ayahResult(s, { number: 0, text: m.text, numberInSurah: m.numberInSurah }, 60 + scoreText(m.text, q, qT)),
    );
  }
  return out;
}

export async function searchQuran(query: string): Promise<SearchResult[]> {
  const out = new Map<string, SearchResult>();
  const add = (r: SearchResult) => {
    const prev = out.get(r.id);
    if (!prev || prev.score < r.score) out.set(r.id, r);
  };

  const ref = await parseAyahRef(query);
  if (ref) {
    const m = /^\d+$/.test(ref.surahQuery)
      ? (await getSurahs()).filter((s) => s.number === Number(ref.surahQuery)).map((s) => ({ s, score: 200 }))
      : await matchSurahs(ref.surahQuery);
    const target = m[0]?.s;
    if (target) {
      const ayahs = await getSurahAyahs(target.number);
      const exact = ayahs.find((a) => a.numberInSurah === ref.ayah);
      if (exact) add(ayahResult(target, exact, 1000));
      for (const a of ayahs.filter((a) => Math.abs(a.numberInSurah - ref.ayah) <= 2 && a.numberInSurah !== ref.ayah)) {
        add(ayahResult(target, a, 400 - Math.abs(a.numberInSurah - ref.ayah)));
      }
    }
  }

  const nameMatches = await matchSurahs(query);
  for (const { s, score } of nameMatches.slice(0, 2)) {
    add(surahResult(s, 500 + score));
    const ayahs = await getSurahAyahs(s.number);
    ayahs.slice(0, 10).forEach((a, i) => add(ayahResult(s, a, 300 + score - i)));
  }

  if (tokens(query).length) {
    for (const r of await searchQuranText(query)) add(r);
  }

  return [...out.values()].sort((a, b) => b.score - a.score).slice(0, 40);
}

export async function searchSurahs(query: string): Promise<SearchResult[]> {
  const list = await getSurahs();
  const matches = await matchSurahs(query);
  if (!normalize(query)) return list.slice(0, 30).map((s) => surahResult(s, 100 - s.number));
  const results = matches.map(({ s, score }) => surahResult(s, score));
  // also surface surahs whose ayahs contain the phrase
  if (results.length < 5) {
    const seen = new Set(results.map((r) => r.id));
    for (const r of await searchQuranText(query)) {
      const num = Number(r.id.split("-")[1]);
      const s = list.find((x) => x.number === num);
      if (s && !seen.has(`surah-${num}`)) {
        seen.add(`surah-${num}`);
        results.push(surahResult(s, 80));
      }
    }
  }
  return results.slice(0, 30);
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

const NAME_BY_ID = new Map(
  [...HADITH_BOOKS, ...ATHAR_BOOKS].map((b) => [b.id, b.name] as const),
);

const bookCache = new Map<string, HadithEdition | null>();

async function getBook(id: string) {
  if (bookCache.has(id)) return bookCache.get(id) ?? null;
  const res = await fetch(
    `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${id}.min.json`,
  );
  if (!res.ok) {
    bookCache.set(id, null);
    return null;
  }
  const json = (await res.json()) as HadithEdition;
  bookCache.set(id, json);
  return json;
}

function hadithResult(bookId: string, h: HadithEntry, kind: ResultKind, score: number): SearchResult {
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

/** narrators whose sayings count as آثار (companions / tabi'in / their followers) */
const ATHAR_NARRATORS = [
  "عمر بن الخطاب","ابي بكر","ابو بكر","عثمان بن عفان","علي بن ابي طالب","ابن عباس","ابن عمر",
  "ابن مسعود","عايشه","ابي هريره","انس بن مالك","زيد بن ثابت","معاذ بن جبل","سلمان",
  "الحسن البصري","سعيد بن المسيب","مجاهد","عطاء","الزهري","ابراهيم النخعي","قتاده","الشعبي",
  "طاوس","عمر بن عبد العزيز","نافع","سفيان الثوري","الاوزاعي","مالك","ابن سيرين","الحسن",
  "عكرمه","عروه","القاسم بن محمد","سالم بن عبد الله",
];

const PROPHET_MARKERS = ["قال رسول الله", "قال النبي", "عن النبي صلي الله عليه وسلم قال", "سمعت رسول الله"];

function isAthar(text: string) {
  const n = normalize(text);
  const hasNarrator = ATHAR_NARRATORS.some((x) => n.includes(x));
  if (!hasNarrator) return false;
  const marker = PROPHET_MARKERS.some((m) => n.includes(m));
  if (!marker) return true;
  // marfu' text: only treat as athar when the narrator's own words are quoted afterwards
  return /(?:قال|كان)\s+(?:عمر|علي|ابن عباس|ابن عمر|ابن مسعود|الحسن|مجاهد|عطاء|قتاده|الزهري|مالك)/.test(n);
}

function parseHadithNumber(query: string, books: { id: string; aliases: string[] }[]) {
  const n = normalize(query);
  const num = n.match(/(\d+)/);
  if (!num) return null;
  const number = Number(num[1]);
  const book = books.find((b) => b.aliases.some((a) => n.includes(normalize(a))));
  return { number, bookId: book?.id };
}

async function searchCollection(
  query: string,
  bookIds: string[],
  kind: ResultKind,
  onlyAthar: boolean,
): Promise<SearchResult[]> {
  const q = normalize(query);
  const qT = tokens(query);
  const catalog = onlyAthar ? ATHAR_BOOKS : HADITH_BOOKS;
  const books = catalog.filter((b) => !bookIds.length || bookIds.includes(b.id));
  const out: SearchResult[] = [];
  const ref = parseHadithNumber(query, books);

  for (const book of books) {
    const data = await getBook(book.id);
    if (!data) continue;

    if (ref && (!ref.bookId || ref.bookId === book.id)) {
      const exact = data.hadiths.find((h) => h.hadithnumber === ref.number);
      if (exact && (!onlyAthar || isAthar(exact.text))) {
        out.push(hadithResult(book.id, exact, kind, 1000));
      }
    }

    if (!qT.length) continue;
    let taken = 0;
    for (const h of data.hadiths) {
      if (taken >= 60) break;
      if (onlyAthar && !isAthar(h.text)) continue;
      const s = scoreText(h.text, q, qT);
      if (s <= 0) continue;
      out.push(hadithResult(book.id, h, kind, s));
      taken++;
    }
  }

  const seen = new Set<string>();
  return out
    .sort((a, b) => b.score - a.score)
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .slice(0, 40);
}

export const searchHadith = (query: string, bookIds?: string[]) =>
  searchCollection(query, bookIds ?? [], "hadith", false);

export const searchAthar = (query: string, bookIds?: string[]) =>
  searchCollection(query, bookIds ?? [], "athar", true);

/* ---------------- unified (smart) search ---------------- */

export async function searchAll(query: string): Promise<SearchResult[]> {
  const [quran, hadith, athar] = await Promise.all([
    searchQuran(query).catch(() => []),
    searchHadith(query).catch(() => []),
    searchAthar(query).catch(() => []),
  ]);
  return [...quran.slice(0, 15), ...hadith.slice(0, 15), ...athar.slice(0, 10)].sort(
    (a, b) => b.score - a.score,
  );
}
