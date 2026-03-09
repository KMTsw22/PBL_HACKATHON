-- Supabase SQL Editor에서 이 파일 내용을 복사해 실행하세요.
-- 또는: supabase db push (Supabase CLI 사용 시)

-- user_cards 테이블 생성
CREATE TABLE IF NOT EXISTS public.user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_name TEXT,
  description TEXT,
  custom_title TEXT,
  custom_content TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 후 재생성 (이미 있으면 무시)
DROP POLICY IF EXISTS "Users can view own cards" ON public.user_cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON public.user_cards;
DROP POLICY IF EXISTS "Users can update own cards" ON public.user_cards;
DROP POLICY IF EXISTS "Users can delete own cards" ON public.user_cards;

CREATE POLICY "Users can view own cards"
  ON public.user_cards FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards"
  ON public.user_cards FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards"
  ON public.user_cards FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards"
  ON public.user_cards FOR DELETE USING (auth.uid() = user_id);

-- 인덱스 (조회 성능)
CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON public.user_cards(user_id);
