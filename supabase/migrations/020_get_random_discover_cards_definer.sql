-- Find: RPC를 SECURITY DEFINER로 변경해 RLS 우회. 다른 사용자 카드는 함수 내부 WHERE로만 제한.
CREATE OR REPLACE FUNCTION public.get_random_discover_cards(
  p_limit int,
  p_exclude_ids uuid[] DEFAULT '{}'
)
RETURNS SETOF public.user_cards
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.user_cards uc
  WHERE auth.uid() IS NOT NULL
    AND uc.user_id <> auth.uid()
    AND uc.id NOT IN (SELECT card_id FROM public.collected_cards WHERE user_id = auth.uid())
    AND (cardinality(p_exclude_ids) = 0 OR uc.id <> ALL(p_exclude_ids))
  ORDER BY random()
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_random_discover_cards(int, uuid[]) IS 'Find: 무작위 명함 N장 (SECURITY DEFINER로 RLS 우회, 본인·수집 제외는 WHERE로 적용)';

GRANT EXECUTE ON FUNCTION public.get_random_discover_cards(int, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_discover_cards(int, uuid[]) TO service_role;
