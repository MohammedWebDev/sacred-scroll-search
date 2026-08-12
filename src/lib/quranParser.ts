// Client-safe smart parser: detects Surah/Ayah references inside a query
// before any external request is made, and refines web queries per category.
import { SURAH_NAMES, SURAH_DISPLAY, SURAH_AYAH_COUNTS } from "@/lib/surahData";

export const normalizeAr = (s: string) =>
  s
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();

export type QuranRef = {
  surah: number;
  ayah?: number;
  surahName: string;
};

const STOP = /(^|\s)(سوره|سورة|ايه|آيه|اية|آية|الايه|رقم|من|في)(\s|$)/g;

/** Parses "البقرة 255", "2:255", "سورة البقرة آية 255", "الكهف". */
export function parseQuranQuery(raw: string): QuranRef | null {
  const q = normalizeAr(raw);
  if (!q) return null;

  // numeric form 2:255 / 2/255 / 2 255
  const numeric = q.match(/^(\d{1,3})\s*[:\-/]\s*(\d{1,3})$/);
  if (numeric) {
    const s = Number(numeric[1]);
    const a = Number(numeric[2]);
    if (valid(s, a)) return ref(s, a);
    return null;
  }

  const cleaned = q.replace(STOP, " ").replace(/\s+/g, " ").trim();

  // trailing / leading ayah number
  const numMatch = cleaned.match(/(\d{1,3})/);
  const ayah = numMatch ? Number(numMatch[1]) : undefined;
  const namePart = cleaned.replace(/\d{1,3}/g, " ").replace(/\s+/g, " ").trim();

  if (!namePart) {
    // pure surah number, e.g. "سورة 18"
    if (ayah && /سوره|سورة/.test(q) && valid(ayah)) return ref(ayah);
    return null;
  }

  const idx = matchSurah(namePart);
  if (idx < 0) return null;
  if (ayah && !valid(idx + 1, ayah)) return ref(idx + 1);
  return ref(idx + 1, ayah);
}

function matchSurah(name: string): number {
  const n = name.replace(/^ال/, "");
  let best = -1;
  for (let i = 0; i < SURAH_NAMES.length; i++) {
    const candidate = SURAH_NAMES[i]!;
    const bare = candidate.replace(/^ال/, "");
    if (candidate === name || bare === n) return i;
    if (bare.length >= 3 && (bare.startsWith(n) || n.startsWith(bare)) && best < 0) best = i;
  }
  return best;
}

function valid(surah: number, ayah?: number) {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return false;
  if (ayah === undefined) return true;
  return Number.isInteger(ayah) && ayah >= 1 && ayah <= (SURAH_AYAH_COUNTS[surah - 1] ?? 0);
}

function ref(surah: number, ayah?: number): QuranRef {
  return { surah, surahName: SURAH_DISPLAY[surah - 1] ?? String(surah), ...(ayah ? { ayah } : {}) };
}

const CATEGORY_SITES: Record<string, string[]> = {
  ayat: ["quran.com", "tafsir.app", "quran.ksu.edu.sa"],
  surah: ["quran.com", "surahquran.com"],
  hadith: ["sunnah.com", "dorar.net", "islamweb.net"],
  athar: ["dorar.net", "islamweb.net", "shamela.ws"],
  web: ["islamqa.info", "dorar.net", "quran.com", "sunnah.com", "islamweb.net"],
};

/** Appends trusted-source operators for the active Islamic category. */
export function refineQuery(query: string, category?: string, site?: string): string {
  const base = query.trim();
  if (site) return `${base} site:${site}`;
  const sites = category ? CATEGORY_SITES[category] : undefined;
  if (!sites?.length) return base;
  return `${base} (${sites.map((s) => `site:${s}`).join(" OR ")})`;
}
