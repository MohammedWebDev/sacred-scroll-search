import { BookOpen, ScrollText, Library, Feather } from "lucide-react";

export type Category = {
  id: string;
  label: string;
  hint: string;
  icon: typeof BookOpen;
  filters: { name: string; value: string }[];
  suggestions: string[];
};

export const CATEGORIES: Category[] = [
  {
    id: "ayat",
    label: "الآيات",
    hint: "ابحث عن كلمة أو جزء من آية",
    icon: BookOpen,
    filters: [],
    suggestions: ["آية الكرسي", "آيات الصبر", "الرزق", "بر الوالدين", "التوبة والاستغفار"],
  },
  {
    id: "hadith",
    label: "الأحاديث",
    hint: "ابحث في نصوص كتب السنة مع بيان درجة الحديث",
    icon: ScrollText,
    filters: [
      { name: "صحيح البخاري", value: "bukhari" },
      { name: "صحيح مسلم", value: "muslim" },
      { name: "سنن أبي داود", value: "abudawud" },
      { name: "سنن الترمذي", value: "tirmidhi" },
    ],
    suggestions: [
      "إنما الأعمال بالنيات",
      "فضل الصلاة",
      "حسن الخلق",
      "صيام عاشوراء",
      "الأربعون النووية",
    ],
  },
  {
    id: "surah",
    label: "السور",
    hint: "اكتب اسم السورة أو رقمها",
    icon: Library,
    filters: [],
    suggestions: ["سورة الكهف", "سورة يس", "سورة الملك", "سورة الرحمن", "سورة البقرة"],
  },
  {
    id: "athar",
    label: "الآثار",
    hint: "ابحث في نصوص الآثار والمرويات",
    icon: Feather,
    filters: [
      { name: "صحيح البخاري", value: "bukhari" },
      { name: "صحيح مسلم", value: "muslim" },
      { name: "سنن أبي داود", value: "abudawud" },
      { name: "سنن الترمذي", value: "tirmidhi" },
    ],
    suggestions: [
      "أثر عن عمر بن الخطاب",
      "أقوال الحسن البصري",
      "آثار السلف في الزهد",
      "قول ابن مسعود",
    ],
  },
];

export const getCategory = (id?: string) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]!;
