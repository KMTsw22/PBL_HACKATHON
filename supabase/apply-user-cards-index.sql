-- Find 페이지 명함 로딩 속도 개선: created_at 정렬용 인덱스
-- Supabase 대시보드 > SQL Editor에서 실행하세요.

CREATE INDEX IF NOT EXISTS idx_user_cards_created_at_desc ON public.user_cards(created_at DESC NULLS LAST);
