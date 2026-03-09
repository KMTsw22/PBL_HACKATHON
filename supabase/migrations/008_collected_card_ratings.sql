-- collected_cards에 private_notes 추가
ALTER TABLE public.collected_cards ADD COLUMN IF NOT EXISTS private_notes TEXT;

-- 수집 시 주제별 점수 저장 (Ask에서 인재 검색에 활용)
CREATE TABLE IF NOT EXISTS public.collected_card_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collected_card_id UUID NOT NULL REFERENCES public.collected_cards(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  score DECIMAL(3,2) NOT NULL CHECK (score >= 0 AND score <= 5),
  is_ai_suggested BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(collected_card_id, category)
);

ALTER TABLE public.collected_card_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage scores of own collected cards"
  ON public.collected_card_scores FOR ALL
  USING (
    collected_card_id IN (
      SELECT id FROM public.collected_cards WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    collected_card_id IN (
      SELECT id FROM public.collected_cards WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_collected_card_scores_collected_card_id ON public.collected_card_scores(collected_card_id);
CREATE INDEX IF NOT EXISTS idx_collected_card_scores_category ON public.collected_card_scores(category);
