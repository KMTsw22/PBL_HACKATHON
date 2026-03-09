-- 카드 소유자가 자신의 카드가 몇 명에게 수집됐는지 조회할 수 있도록 정책 추가
CREATE POLICY "Card owners can view collections of their cards"
  ON public.collected_cards FOR SELECT
  USING (
    card_id IN (SELECT id FROM public.user_cards WHERE user_id = auth.uid())
  );
