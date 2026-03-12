-- get_collected_cards_by_user_id RPC 403 해결: 생성 및 실행 권한 부여
-- p_user_id는 본인(auth.uid())일 때만 조회되며, 타인 id면 빈 결과 반환

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

COMMENT ON FUNCTION public.get_collected_cards_by_user_id(uuid) IS '현재 로그인 사용자의 수집 목록 조회 (본인만)';

GRANT EXECUTE ON FUNCTION public.get_collected_cards_by_user_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_collected_cards_by_user_id(uuid) TO service_role;
