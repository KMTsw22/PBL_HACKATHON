-- 로그인한 사용자가 시드 카드(기존 36 + 확장 92 = 128장) 전부를 한 번에 수집함에 넣는 RPC
-- 앱에서 supabase.rpc('collect_all_seed_cards') 호출 시, auth.uid() 계정에 수집 + 점수 부여

CREATE OR REPLACE FUNCTION public.collect_all_seed_cards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inserted int := 0;
  v_cc_id uuid;
  v_card_id uuid;
  v_cat text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '로그인이 필요합니다.');
  END IF;

  -- 1) 시드 카드 전부 수집 (데모 계정 d500xxxx-... 소유 카드)
  INSERT INTO public.collected_cards (user_id, card_id)
  SELECT v_uid, uc.id
  FROM public.user_cards uc
  WHERE uc.user_id::text LIKE 'd500%9c0b-4ef8-bb6d-6bb9bd380a11'
  ON CONFLICT (user_id, card_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 2) 방금 수집된 카드 포함, 수집된 시드 카드들에 점수 0.5~4.5 랜덤 부여
  INSERT INTO public.collected_card_scores (collected_card_id, category, score, is_ai_suggested)
  SELECT cc.id, cat.category,
         round((0.5 + random() * 4)::numeric, 1),
         false
  FROM public.collected_cards cc
  CROSS JOIN (VALUES ('Expertise'), ('Professionalism'), ('Communication')) AS cat(category)
  WHERE cc.user_id = v_uid
    AND cc.card_id IN (
      SELECT id FROM public.user_cards WHERE user_id::text LIKE 'd500%9c0b-4ef8-bb6d-6bb9bd380a11'
    )
  ON CONFLICT (collected_card_id, category) DO UPDATE SET
    score = EXCLUDED.score;

  RETURN jsonb_build_object(
    'ok', true,
    'collected_count', (SELECT count(*) FROM public.collected_cards WHERE user_id = v_uid AND card_id IN (SELECT id FROM public.user_cards WHERE user_id::text LIKE 'd500%9c0b-4ef8-bb6d-6bb9bd380a11')),
    'newly_inserted', v_inserted
  );
END;
$$;

COMMENT ON FUNCTION public.collect_all_seed_cards() IS '시드 카드(128장) 전부를 현재 로그인 사용자 수집함에 추가하고 점수 부여. 앱에서 호출.';
