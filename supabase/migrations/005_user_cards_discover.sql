-- Find 페이지에서 모든 유저의 카드를 랜덤 조회할 수 있도록 정책 추가
DROP POLICY IF EXISTS "Users can view own cards" ON public.user_cards;
CREATE POLICY "Authenticated users can view all cards"
  ON public.user_cards FOR SELECT
  USING (auth.uid() IS NOT NULL);
