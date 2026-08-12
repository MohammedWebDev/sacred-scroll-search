import { createServerFn } from "@tanstack/react-start";

export type AyahPayload = {
  surah: number;
  ayah?: number;
  surahName: string;
  englishName?: string;
  numberOfAyahs?: number;
  revelation?: string;
  text?: string;
  tafsir?: string;
  url: string;
  error?: string;
};

export const getAyah = createServerFn({ method: "POST" })
  .inputValidator((input: { surah: number; ayah?: number }) => ({
    surah: Math.min(114, Math.max(1, Number(input.surah) || 1)),
    ayah: input.ayah ? Math.max(1, Number(input.ayah)) : undefined,
  }))
  .handler(async ({ data }): Promise<AyahPayload> => {
    const { surah, ayah } = data;
    const url = ayah
      ? `https://quran.com/${surah}/${ayah}`
      : `https://quran.com/${surah}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      if (ayah) {
        const res = await fetch(
          `https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/editions/quran-uthmani,ar.muyassar`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("upstream");
        const json = (await res.json()) as {
          data: Array<{
            text: string;
            surah: { name: string; englishName: string; numberOfAyahs: number; revelationType: string };
          }>;
        };
        const main = json.data[0];
        if (!main) throw new Error("empty");
        return {
          surah,
          ayah,
          surahName: main.surah.name.replace(/^سُورَةُ\s*/, ""),
          englishName: main.surah.englishName,
          numberOfAyahs: main.surah.numberOfAyahs,
          revelation: main.surah.revelationType === "Meccan" ? "مكية" : "مدنية",
          text: main.text,
          ...(json.data[1]?.text ? { tafsir: json.data[1].text } : {}),
          url,
        };
      }

      const res = await fetch(`https://api.alquran.cloud/v1/surah/${surah}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("upstream");
      const json = (await res.json()) as {
        data: {
          name: string;
          englishName: string;
          numberOfAyahs: number;
          revelationType: string;
          ayahs: Array<{ text: string }>;
        };
      };
      return {
        surah,
        surahName: json.data.name.replace(/^سُورَةُ\s*/, ""),
        englishName: json.data.englishName,
        numberOfAyahs: json.data.numberOfAyahs,
        revelation: json.data.revelationType === "Meccan" ? "مكية" : "مدنية",
        ...(json.data.ayahs[0]?.text ? { text: json.data.ayahs[0].text } : {}),
        url,
      };
    } catch {
      return { surah, ...(ayah ? { ayah } : {}), surahName: String(surah), url, error: "upstream" };
    } finally {
      clearTimeout(timer);
    }
  });
