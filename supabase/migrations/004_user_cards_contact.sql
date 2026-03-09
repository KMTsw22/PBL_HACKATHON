-- user_cards에 Links & Portfolio, Contact Info 컬럼 추가 (선택 입력)

ALTER TABLE public.user_cards ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE public.user_cards ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_cards ADD COLUMN IF NOT EXISTS kakao_id TEXT;
ALTER TABLE public.user_cards ADD COLUMN IF NOT EXISTS phone TEXT;
