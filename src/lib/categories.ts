import { BookOpen, ScrollText, Library, Feather } from "lucide-react";

export type Category = {
  id: string;
  label: string;
  hint: string;
  icon: typeof BookOpen;
  sites: { name: string; domain: string }[];
  suggestions: string[];
};

export const CATEGORIES: Category[] = [
  {
    id: "ayat",
    label: "الآيات",
    hint: "ابحث عن آية أو معنى في القرآن الكريم",
    icon: BookOpen,
    sites: [
      { name: "القرآن الكريم", domain: "quran.com" },
      { name: "تنزيل", domain: "tanzil.net" },
      { name: "التفسير", domain: "altafsir.com" },
      { name: "الباحث القرآني", domain: "tafsir.app" },
    ],
    suggestions: ["آية الكرسي", "آيات الصبر", "الرزق", "بر الوالدين", "التوبة والاستغفار"],
  },
  {
    id: "hadith",
    label: "الأحاديث",
    hint: "ابحث في كتب السنة مع بيان درجة الحديث",
    icon: ScrollText,
    sites: [
      { name: "سنة", domain: "sunnah.com" },
      { name: "الدرر السنية", domain: "dorar.net" },
      { name: "إسلام ويب", domain: "islamweb.net" },
      { name: "الشاملة", domain: "shamela.ws" },
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
    hint: "اقرأ سورة كاملة مع التفسير والتلاوة",
    icon: Library,
    sites: [
      { name: "القرآن الكريم", domain: "quran.com" },
      { name: "الباحث القرآني", domain: "tafsir.app" },
      { name: "تنزيل", domain: "tanzil.net" },
    ],
    suggestions: ["سورة الكهف", "سورة يس", "سورة الملك", "سورة الرحمن", "سورة البقرة"],
  },
  {
    id: "athar",
    label: "الآثار",
    hint: "أقوال الصحابة والتابعين وسلف الأمة",
    icon: Feather,
    sites: [
      { name: "الدرر السنية", domain: "dorar.net" },
      { name: "الشاملة", domain: "shamela.ws" },
      { name: "الألوكة", domain: "alukah.net" },
      { name: "إسلام ويب", domain: "islamweb.net" },
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
