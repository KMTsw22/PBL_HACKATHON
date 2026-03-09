-- collected_cards private_notes 수정을 위한 UPDATE 정책
CREATE POLICY "Users can update own collected cards"
  ON public.collected_cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
