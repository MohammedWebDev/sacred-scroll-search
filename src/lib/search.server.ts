import { prepareQuery, normalize, scoreText, nameMatch, TopK, type PreparedQuery } from "@/lib/relevance";
import { parseIntent, detectBook } from "@/lib/query-intent";
import { ATHAR, ATHAR_SOURCES, type AtharEntry } from "@/lib/athar-data";

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

/** true when `needle` appears in `hay` as whole word(s), not as a letter inside a word */
function containsWord(hay: string, needle: string) {
  if (!needle) return false;
  const words = hay.split(" ");
  const parts = needle.split(" ");
  for (let i = 0; i + parts.length <= words.length; i++) {
    if (parts.every((p, j) => words[i + j] === p)) return true;
  }
  return false;
}

async function matchSurahs(query: string) {
  const list = await getSurahs();
  const q = normalize(query).replace(/^سوره\s*/, "").trim();
  if (!q) return [] as { s: SurahMeta; score: number }[];
  const askedForSurah = /\bسوره\b/.test(normalize(query));
  const out: { s: SurahMeta; score: number }[] = [];
  for (const s of list) {
    const name = surahClean(s.name);
    const bare = name.replace(/^ال/, "");
    const en = s.englishName.toLowerCase().replace(/[^a-z]/g, "");
    const qBare = q.replace(/^ال/, "");
    const qEn = q.replace(/[^a-z]/g, "");
    // one/two letter names (ق، ص، ن، طه، يس) only count on an exact ask
    const shortName = bare.length < 3;
    let score = 0;
    if (String(s.number) === q) score = 100;
    else if (name === q || bare === qBare) score = 98;
    else if (!shortName && (name.startsWith(q) || bare.startsWith(qBare)) && q.length >= 3) score = 88;
    else if (!shortName && (containsWord(q, name) || containsWord(q, bare)))
      score = askedForSurah ? 92 : 80;
    else if (!shortName && name.includes(q) && q.length > 3) score = 70;
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

  // 2) surah name / number — only when the query really is a surah name,
  //    otherwise a passing word must not flood the page with unrelated ayat
  const nameMatches = await matchSurahs(intent.text || query);
  const namesOnlyQuery = q.tokens.length <= 2;
  for (const { s, score } of nameMatches.slice(0, 2)) {
    if (refAyah || score < 80) continue;
    if (!namesOnlyQuery && score < 92) continue;
    add(surahResult(s, Math.min(97, score)));
    if (score >= 88) {
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

const NAME_BY_ID = new Map(HADITH_BOOKS.map((b) => [b.id, b.name] as const));

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
  const text = stripIsnad(h.text);
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

async function searchCollection(
  query: string,
  bookIds: string[],
  kind: ResultKind,
): Promise<SearchResult[]> {
  const q = prepareQuery(query);
  const intent = parseIntent(query);
  const catalog = HADITH_BOOKS;
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
        if (exact) exacts.push(hadithResult(book.id, exact, kind, 100));
      }

      if (!q.tokens.length) return;
      const bookBoost = requestedBook === book.id ? 6 : 0;
      for (const h of data.hadiths) {
        const n = normalize(h.text);
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
  searchCollection(query, bookIds ?? [], "hadith");

/* ---------------- Athar (sayings & stories of the Salaf) ---------------- */

/**
 * Removes the chain of narration so the reader sees the saying itself.
 * "حدثنا فلان عن فلان قال: قال عمر: ..." → "قال عمر: ..."
 */
export function stripIsnad(text: string) {
  const original = sanitizeText(text);
  let t = original;
  // drop the reporting chain that opens the text, up to the last "قال" of the chain
  const chain =
    /^(?:حدثنا|حدثني|أخبرنا|أخبرنى|أخبرني|أنبأنا|أنبأني|نا|ثنا|قرأت على|سمعت|وحدثنا|وحدثني|وحدثناه|وحدثنيه|وأخبرنا|وأخبرني|عن)\b/u;
  if (chain.test(t)) {
    const m = t.match(
      /^[\s\S]{0,600}?(?:قال|قالت|يقول|أنه قال)\s*[:؛]?\s*(?:رسول الله|النبي)?\s*(?:صلى الله عليه وسلم|صلى الله عليه وآله وسلم)?\s*[:؛]?\s*/u,
    );
    if (m && m[0].length < original.length - 20) t = original.slice(m[0].length);
  }
  t = t.replace(/^(?:رضي الله عنه[ما]?|رحمه الله)\s*[:؛]?\s*/u, "");
  return (t.trim() || original).trim();
}


const atharUrl = (a: AtharEntry) =>
  `https://dorar.net/hadith/search?q=${encodeURIComponent(a.text.split(" ").slice(0, 7).join(" "))}`;

function atharResult(a: AtharEntry, i: number, score: number): SearchResult {
  const src = ATHAR_SOURCES.find((s) => s.id === a.src);
  const source = src ? `${src.name} — ${src.author}` : a.src;
  return {
    id: `athar-${i}`,
    kind: "athar",
    title: `${a.by} — ${a.type === "قصة" ? "قصة" : "قول"}`,
    url: atharUrl(a),
    snippet: stripIsnad(a.text),
    domain: source,
    reference: src ? src.name : source,
    grade: a.type,
    score,
  };
}

export async function searchAthar(query: string, srcIds?: string[]): Promise<SearchResult[]> {
  const q = prepareQuery(query);
  const pool = ATHAR.map((a, i) => ({ a, i })).filter(
    ({ a }) => !srcIds?.length || srcIds.includes(a.src),
  );
  if (!q.tokens.length) {
    return pool.slice(0, 40).map(({ a, i }) => atharResult(a, i, 60));
  }

  // does the query name a speaker or a source in this corpus?
  const speakerHit = Math.max(0, ...pool.map(({ a }) => nameMatch(a.by, q)));
  const isSpeakerQuery = speakerHit >= 0.6;

  const out: SearchResult[] = [];
  for (const { a, i } of pool) {
    const src = ATHAR_SOURCES.find((s) => s.id === a.src);
    const byHit = nameMatch(a.by, q);
    const srcHit = src ? Math.max(nameMatch(src.name, q), nameMatch(src.author, q)) : 0;
    const tagSc = scoreText(a.tags.join(" "), q);
    const textSc = scoreText(a.text, q);
    const topic = Math.max(textSc, tagSc * 0.95);

    let s = topic;
    if (byHit >= 0.6) {
      // naming the speaker surfaces everything they said, best topical match first
      s = Math.min(99, 82 + byHit * 6 + Math.min(11, topic / 8));
    } else if (isSpeakerQuery) {
      // another speaker only belongs here when it answers the topic strongly
      if (topic < 60) continue;
      s = topic - 10;
    } else if (srcHit >= 0.6) {
      s = Math.max(s, 74 + Math.min(12, topic / 8));
    }
    if (s < 30) continue;
    out.push(atharResult(a, i, Math.round(s * 10) / 10));
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 60);
}

/* ---------------- unified (smart) search ---------------- */

export async function searchAll(query: string): Promise<SearchResult[]> {
  const intent = parseIntent(query);
  const [quran, hadith, athar] = await Promise.all([
    searchQuran(query).catch(() => []),
    searchHadith(query).catch(() => []),
    intent.numberOnly ? Promise.resolve([]) : searchAthar(query).catch(() => []),
  ]);

  // an exact ayah reference must not be tied with hadiths sharing that number
  const exactAyah = quran.some((r) => r.score >= 100);
  const adjust = (r: SearchResult) => (exactAyah && r.score >= 100 ? { ...r, score: 80 } : r);

  // a verbatim Quran phrase must outrank a hadith that merely quotes it
  const qNorm = normalize(query);
  const quranPhrase =
    qNorm.length > 8 && quran.some((r) => r.kind === "ayah" && normalize(r.snippet).includes(qNorm));
  const boost = (r: SearchResult) =>
    quranPhrase && r.kind === "ayah" ? { ...r, score: Math.min(100, r.score + 12) } : r;

  // asking about a person of the Salaf: their own words answer better than an isnad echo
  const salafQuery = athar.some((r) => r.kind === "athar" && r.score >= 82);
  const demote = (r: SearchResult) =>
    salafQuery && r.kind === "hadith" ? { ...r, score: Math.min(r.score, 70) } : r;

  const merged = [
    ...quran.slice(0, 25).map(boost),
    ...hadith.slice(0, 25).map(adjust).map(demote),
    ...athar.slice(0, 20).map(adjust),
  ].sort((a, b) => b.score - a.score);


  // one card per source: an athar and a hadith can point at the same text
  const seen = new Set<string>();
  return merged.filter((r) => {
    const key = `${r.url}|${normalize(r.snippet).slice(0, 90)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
