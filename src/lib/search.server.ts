export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  domain: string;
};

const normalize = (s: string) =>
  s
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();

/* ---------------- Quran ---------------- */

type AyahMatch = {
  text: string;
  numberInSurah: number;
  surah: { number: number; name: string; englishName: string };
};

export async function searchQuran(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.alquran.cloud/v1/search/${encodeURIComponent(query)}/all/quran-simple`,
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { matches?: AyahMatch[] } };
  const matches = json.data?.matches ?? [];
  return matches.slice(0, 25).map((m) => ({
    title: `${m.surah.name} — الآية ${m.numberInSurah}`,
    url: `https://quran.com/${m.surah.number}/${m.numberInSurah}`,
    snippet: m.text,
    domain: "القرآن الكريم",
  }));
}

/* ---------------- Surahs ---------------- */

type SurahMeta = {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
  revelationType: string;
};

let surahCache: SurahMeta[] | null = null;

async function getSurahs() {
  if (surahCache) return surahCache;
  const res = await fetch("https://api.alquran.cloud/v1/surah");
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: SurahMeta[] };
  surahCache = json.data ?? [];
  return surahCache;
}

export async function searchSurahs(query: string): Promise<SearchResult[]> {
  const list = await getSurahs();
  const q = normalize(query).replace(/^سوره\s*/, "");
  const hits = q
    ? list.filter(
        (s) =>
          normalize(s.name).includes(q) ||
          s.englishName.toLowerCase().includes(q.toLowerCase()) ||
          String(s.number) === q,
      )
    : list;
  return hits.slice(0, 30).map((s) => ({
    title: `${s.name} (${s.englishName})`,
    url: `https://quran.com/${s.number}`,
    snippet: `السورة رقم ${s.number} — ${s.numberOfAyahs} آية — ${
      s.revelationType === "Meccan" ? "مكية" : "مدنية"
    }`,
    domain: "القرآن الكريم",
  }));
}

/* ---------------- Hadith ---------------- */

type HadithEdition = {
  hadiths: { hadithnumber: number; text: string; grades?: { name: string; grade: string }[] }[];
};

const BOOKS: { id: string; name: string }[] = [
  { id: "bukhari", name: "صحيح البخاري" },
  { id: "muslim", name: "صحيح مسلم" },
  { id: "abudawud", name: "سنن أبي داود" },
  { id: "tirmidhi", name: "سنن الترمذي" },
];

const bookCache = new Map<string, HadithEdition>();

async function getBook(id: string) {
  const cached = bookCache.get(id);
  if (cached) return cached;
  const res = await fetch(
    `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${id}.min.json`,
  );
  if (!res.ok) return null;
  const json = (await res.json()) as HadithEdition;
  bookCache.set(id, json);
  return json;
}

export async function searchHadith(query: string, bookIds?: string[]): Promise<SearchResult[]> {
  const q = normalize(query);
  if (!q) return [];
  const books = BOOKS.filter((b) => !bookIds?.length || bookIds.includes(b.id));
  const out: SearchResult[] = [];

  for (const book of books) {
    const data = await getBook(book.id);
    if (!data) continue;
    for (const h of data.hadiths) {
      if (out.length >= 40) break;
      if (!normalize(h.text).includes(q)) continue;
      const grade = h.grades?.find((g) => g.grade)?.grade;
      out.push({
        title: `${book.name} — حديث رقم ${h.hadithnumber}${grade ? ` (${grade})` : ""}`,
        url: `https://sunnah.com/${book.id}:${h.hadithnumber}`,
        snippet: h.text.length > 420 ? `${h.text.slice(0, 420)}…` : h.text,
        domain: book.name,
      });
    }
    if (out.length >= 40) break;
  }
  return out.slice(0, 25);
}

export const HADITH_BOOKS = BOOKS;
