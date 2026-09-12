import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "raqeem-session-id";

export type LiveStats = {
  activeNow: number;
  dailyAvg: number;
  searchesToday: number;
  searchesHour: number;
  visitsTotal: number;
  usersTotal: number;
};

export const EMPTY_LIVE: LiveStats = {
  activeNow: 0,
  dailyAvg: 0,
  searchesToday: 0,
  searchesHour: 0,
  visitsTotal: 0,
  usersTotal: 0,
};

function sessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon-fallback-session";
  }
}

/** record an anonymous activity event (no personal data) */
export async function track(kind: "visit" | "ping" | "search", query?: string) {
  try {
    await supabase.from("site_events").insert({
      session_id: sessionId(),
      kind,
      query: query ? query.slice(0, 200) : null,
    });
  } catch {
    /* stats must never break the page */
  }
}

export async function fetchLiveStats(): Promise<LiveStats> {
  const { data, error } = await supabase.rpc("site_stats");
  if (error || !data) return EMPTY_LIVE;
  return { ...EMPTY_LIVE, ...(data as Partial<LiveStats>) };
}
