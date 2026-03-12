-- 예시 카드 전부 수집 + 점수 0.5~4.5 랜덤 (수동 실행용)
-- **권장:** 앱 설정(Settings) > "예시 카드 전부 수집" 버튼으로 로그인한 내 계정에 한 번에 넣을 수 있음.
-- 아래 user_id가 수집 대상 계정 (본인: bcee0868-631c-4ec4-bc64-b7a94239103a)

-- 1) 시드 카드 전부(기존 36 + 확장 92 = 128장) 해당 계정에 수집 (중복 시 스킵)
INSERT INTO public.collected_cards (user_id, card_id)
SELECT 'bcee0868-631c-4ec4-bc64-b7a94239103a'::uuid, uc.id
FROM public.user_cards uc
WHERE uc.user_id::text LIKE 'd500%9c0b-4ef8-bb6d-6bb9bd380a11'
ON CONFLICT (user_id, card_id) DO NOTHING;

-- 2) 수집된 카드들에 대해 점수 0.5 ~ 4.5 랜덤 부여 (이미 있으면 점수만 갱신)
INSERT INTO public.collected_card_scores (collected_card_id, category, score, is_ai_suggested)
SELECT cc.id, cat.category,
       round((0.5 + random() * 4)::numeric, 1),
       false
FROM public.collected_cards cc
CROSS JOIN (VALUES ('Expertise'), ('Professionalism'), ('Communication')) AS cat(category)
WHERE cc.user_id = 'bcee0868-631c-4ec4-bc64-b7a94239103a'::uuid
  AND cc.card_id IN (SELECT id FROM public.user_cards WHERE user_id::text LIKE 'd500%9c0b-4ef8-bb6d-6bb9bd380a11')
ON CONFLICT (collected_card_id, category) DO UPDATE SET
  score = EXCLUDED.score;
