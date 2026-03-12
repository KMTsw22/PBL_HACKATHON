-- Find: DB에서 무작위 N장 조회 RPC (Supabase 대시보드 SQL Editor에서 실행)
-- 마이그레이션 018과 동일

CREATE OR REPLACE FUNCTION public.get_random_discover_cards(
  p_limit int,
  p_exclude_ids uuid[] DEFAULT '{}'
)
RETURNS SETOF public.user_cards
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.user_cards
  WHERE user_id != auth.uid()
    AND (cardinality(p_exclude_ids) = 0 OR id != ALL(p_exclude_ids))
  ORDER BY random()
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_discover_cards(int, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_discover_cards(int, uuid[]) TO service_role;
