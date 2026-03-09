-- Find에서 수집한 카드 저장용 테이블
CREATE TABLE IF NOT EXISTS public.collected_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.user_cards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, card_id)
);

ALTER TABLE public.collected_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own collected cards"
  ON public.collected_cards FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own collected cards"
  ON public.collected_cards FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own collected cards"
  ON public.collected_cards FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_collected_cards_user_id ON public.collected_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_collected_cards_card_id ON public.collected_cards(card_id);
