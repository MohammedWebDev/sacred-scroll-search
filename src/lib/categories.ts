import { BookOpen, ScrollText, Library, Feather, Sparkles, Globe } from "lucide-react";

export type Category = {
  id: string;
  label: string;
  hint: string;
  icon: typeof BookOpen;
  filters: { name: string; value: string }[];
  suggestions: string[];
};

const HADITH_FILTERS = [
  { name: "صحيح البخاري", value: "bukhari" },
  { name: "صحيح مسلم", value: "muslim" },
  { name: "سنن أبي داود", value: "abudawud" },
  { name: "سنن الترمذي", value: "tirmidhi" },
  { name: "سنن النسائي", value: "nasai" },
  { name: "سنن ابن ماجه", value: "ibnmajah" },
  { name: "الأربعون النووية", value: "nawawi" },
];

const ATHAR_FILTERS = [
  { name: "موطأ مالك", value: "malik" },
  { name: "صحيح البخاري", value: "bukhari" },
  { name: "صحيح مسلم", value: "muslim" },
  { name: "سنن أبي داود", value: "abudawud" },
];

export const CATEGORIES: Category[] = [
  {
    id: "all",
    label: "الكل",
    hint: "ابحث بكلمة، أو اسم سورة، أو رقم آية، أو رقم حديث…",
    icon: Sparkles,
    filters: [],
    suggestions: ["البقرة 255", "سورة الكهف", "إنما الأعمال بالنيات", "الصبر", "بر الوالدين"],
  },
  {
    id: "web",
    label: "الويب",
    hint: "بحث في المواقع الإسلامية الموثوقة عبر محرك بحث جوجل",
    icon: Globe,
    filters: [
      { name: "quran.com", value: "quran.com" },
      { name: "sunnah.com", value: "sunnah.com" },
      { name: "dorar.net", value: "dorar.net" },
      { name: "islamweb.net", value: "islamweb.net" },
      { name: "islamqa.info", value: "islamqa.info" },
    ],
    suggestions: ["تفسير آية الكرسي", "شرح حديث النية", "فضل سورة الكهف", "أقوال الصحابة في الزهد"],
  },
  {
    id: "ayat",
    label: "الآيات",
    hint: "اسم السورة، رقم الآية (مثل: البقرة 255) أو كلمة من الآية",
    icon: BookOpen,
    filters: [],
    suggestions: ["آية الكرسي", "البقرة 255", "الكهف 10", "آيات الصبر", "الرزق"],
  },
  {
    id: "hadith",
    label: "الأحاديث",
    hint: "نص الحديث، أو اسم الكتاب مع رقم الحديث (مثل: البخاري 1)",
    icon: ScrollText,
    filters: HADITH_FILTERS,
    suggestions: [
      "إنما الأعمال بالنيات",
      "البخاري 1",
      "فضل الصلاة",
      "حسن الخلق",
      "الأربعون النووية",
    ],
  },
  {
    id: "surah",
    label: "السور",
    hint: "اكتب اسم السورة أو رقمها",
    icon: Library,
    filters: [],
    suggestions: ["سورة الكهف", "سورة يس", "سورة الملك", "سورة الرحمن", "18"],
  },
  {
    id: "athar",
    label: "الآثار",
    hint: "أقوال الصحابة والتابعين وأتباعهم ومروياتهم",
    icon: Feather,
    filters: ATHAR_FILTERS,
    suggestions: [
      "عمر بن الخطاب",
      "ابن مسعود",
      "الحسن البصري",
      "الزهد",
      "سعيد بن المسيب",
    ],
  },
];

export const getCategory = (id?: string) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]!;

export const KIND_LABEL: Record<string, string> = {
  ayah: "آية",
  surah: "سورة",
  hadith: "حديث",
  athar: "أثر",
  web: "ويب",
};
