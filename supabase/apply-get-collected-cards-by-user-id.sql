-- get_collected_cards_by_user_id RPC 403 해결 (Supabase 대시보드 SQL Editor에서 실행)
-- Messages/채팅 화면에서 이 RPC 호출 시 403 나오면 실행하세요.

CREATE OR REPLACE FUNCTION public.get_collected_cards_by_user_id(p_user_id uuid DEFAULT NULL)
RETURNS SETOF public.collected_cards
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.collected_cards
  WHERE user_id = auth.uid()
    AND (p_user_id IS NULL OR user_id = p_user_id)
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_collected_cards_by_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_collected_cards_by_user_id(uuid) TO service_role;
