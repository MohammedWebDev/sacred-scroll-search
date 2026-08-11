// Central resolver for the Google Programmable Search credentials.
// Reads runtime env lazily (never at module scope) and always yields a CX,
// so a missing/renamed secret degrades gracefully instead of crashing.

export const DEFAULT_CX = "238bd6009d27343a2";

const KEY_NAMES = [
  "GOOGLE_API_KEY",
  "GOOGLE_SEARCH_API_KEY",
  "VITE_GOOGLE_SEARCH_API_KEY",
] as const;

export type SearchConfig = {
  apiKey: string | undefined;
  cx: string;
  configured: boolean;
};

/** Server-side only: call inside a server function handler. */
export function getSearchConfig(): SearchConfig {
  const env: Record<string, string | undefined> =
    typeof process !== "undefined" && process.env ? process.env : {};

  let apiKey: string | undefined;
  for (const name of KEY_NAMES) {
    const value = env[name]?.trim();
    if (value) {
      apiKey = value;
      break;
    }
  }

  const cx = env["GOOGLE_SEARCH_CX"]?.trim() || DEFAULT_CX;
  return { apiKey, cx, configured: Boolean(apiKey) };
}
