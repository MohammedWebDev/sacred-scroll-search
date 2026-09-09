import { searchAll, searchQuran, searchSurahs, searchHadith, searchAthar } from "./lib/search.server";
const qs = ["اقوال عبدالله بن المبارك في الزهد","الحكم العطائية","الزهد","عبدالله بن المبارك"];
for (const q of qs) {
  console.log("\n===== " + q);
  for (const [name, fn] of [["all",searchAll],["quran",searchQuran],["surah",searchSurahs],["hadith",searchHadith],["athar",searchAthar]] as const) {
    const r = await (fn as any)(q);
    console.log(`-- ${name}: ${r.length}`);
    for (const x of r.slice(0,4)) console.log(`   [${x.score}] ${x.kind} | ${x.title} | ${x.snippet.slice(0,70)}`);
  }
}
