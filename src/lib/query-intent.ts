import { normalize } from "@/lib/relevance";

/** Companions / tabi'in / their followers — used to route "who said it" queries. */
export const ATHAR_NARRATORS = [
  "عمر بن الخطاب", "ابو بكر الصديق", "ابي بكر", "ابو بكر", "عثمان بن عفان", "علي بن ابي طالب",
  "ابن عباس", "ابن عمر", "ابن مسعود", "ابن الزبير", "ابن عمرو", "عايشه", "ابي هريره",
  "انس بن مالك", "زيد بن ثابت", "معاذ بن جبل", "سلمان الفارسي", "ابي ذر", "ابي الدرداء",
  "حذيفه", "عماره", "بلال", "خباب", "طلحه", "الزبير", "سعد بن ابي وقاص", "عبد الرحمن بن عوف",
  "الحسن البصري", "سعيد بن المسيب", "مجاهد", "عطاء", "الزهري", "ابراهيم النخعي", "قتاده",
  "الشعبي", "طاوس", "عمر بن عبد العزيز", "نافع", "سفيان الثوري", "الاوزاعي", "مالك",
  "ابن سيرين", "عكرمه", "عروه", "القاسم بن محمد", "سالم بن عبد الله", "الاعمش", "وكيع",
  "ابن المبارك", "الفضيل بن عياض", "احمد بن حنبل", "الشافعي", "ابو حنيفه",
].map((n) => normalize(n));

export type QueryIntent = {
  /** numeric part of the query, if any */
  number?: number;
  /** "surah:ayah" style reference */
  pair?: { first: number; second: number };
  /** text with digits removed (a possible surah / book / person name) */
  text: string;
  /** true when the query names a companion or successor */
  person?: string;
  /** true when the query is only a number */
  numberOnly: boolean;
};

export function parseIntent(query: string): QueryIntent {
  const n = normalize(query);
  const pairMatch = n.match(/(\d+)\s*[:\/\-]\s*(\d+)/);
  const numMatch = n.match(/(\d+)/);
  const text = n.replace(/\d+/g, " ").replace(/\s+/g, " ").trim();
  const person = ATHAR_NARRATORS.find((p) => text && (text.includes(p) || p.includes(text)) && text.length > 3);

  const intent: QueryIntent = {
    text,
    numberOnly: Boolean(numMatch) && !text,
  };
  if (pairMatch) intent.pair = { first: Number(pairMatch[1]), second: Number(pairMatch[2]) };
  if (numMatch) intent.number = Number(numMatch[1]);
  if (person) intent.person = person;
  return intent;
}

/** finds a book id whose name/alias appears in the query */
export function detectBook(
  query: string,
  books: { id: string; name: string; aliases: string[] }[],
): string | undefined {
  const n = normalize(query);
  if (!n) return undefined;
  for (const b of books) {
    const candidates = [b.name, ...b.aliases].map(normalize);
    if (candidates.some((c) => c && n.includes(c))) return b.id;
  }
  return undefined;
}
