CREATE TABLE public.site_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('visit','ping','search')),
  query TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX site_events_created_at_idx ON public.site_events (created_at DESC);
CREATE INDEX site_events_kind_created_idx ON public.site_events (kind, created_at DESC);

GRANT INSERT ON public.site_events TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.site_events_id_seq TO anon, authenticated;
GRANT ALL ON public.site_events TO service_role;

ALTER TABLE public.site_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can record activity"
ON public.site_events FOR INSERT TO anon, authenticated
WITH CHECK (char_length(session_id) BETWEEN 6 AND 64 AND (query IS NULL OR char_length(query) <= 200));

CREATE OR REPLACE FUNCTION public.site_stats()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'activeNow', (SELECT count(DISTINCT session_id) FROM public.site_events WHERE created_at > now() - interval '5 minutes'),
    'dailyAvg', COALESCE((
      SELECT round(avg(c))::int FROM (
        SELECT count(DISTINCT session_id) AS c
        FROM public.site_events
        WHERE created_at > now() - interval '7 days'
        GROUP BY date_trunc('day', created_at)
      ) d
    ), 0),
    'searchesToday', (SELECT count(*) FROM public.site_events WHERE kind = 'search' AND created_at > date_trunc('day', now())),
    'searchesHour', (SELECT count(*) FROM public.site_events WHERE kind = 'search' AND created_at > now() - interval '1 hour'),
    'visitsTotal', (SELECT count(*) FROM public.site_events WHERE kind = 'visit'),
    'usersTotal', (SELECT count(DISTINCT session_id) FROM public.site_events)
  );
$$;

GRANT EXECUTE ON FUNCTION public.site_stats() TO anon, authenticated;