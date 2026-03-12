-- Find: DB에서 무작위 N장 조회 RPC (Supabase 대시보드 SQL Editor에서 실행)
-- auth.uid()로 본인 카드·수집한 카드 제외. 인자는 p_limit만.

CREATE OR REPLACE FUNCTION public.get_random_discover_cards(p_limit int)
RETURNS SETOF public.user_cards
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.user_cards uc
  WHERE auth.uid() IS NOT NULL
    AND uc.user_id <> auth.uid()
    AND uc.id NOT IN (SELECT card_id FROM public.collected_cards WHERE user_id = auth.uid())
  ORDER BY random()
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_discover_cards(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_random_discover_cards(int) TO service_role;
