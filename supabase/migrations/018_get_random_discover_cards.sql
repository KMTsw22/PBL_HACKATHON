-- Find: DB에서 무작위로 N장 조회 (본인 제외). 클라이언트는 RPC만 호출하면 됨.
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

COMMENT ON FUNCTION public.get_random_discover_cards(int, uuid[]) IS 'Find: 무작위 명함 N장 (본인 제외, p_exclude_ids 제외)';

GRANT EXECUTE ON FUNCTION public.get_random_discover_cards(int, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_discover_cards(int, uuid[]) TO service_role;
