-- Find 페이지 discover 쿼리 가속: created_at DESC 정렬용 인덱스
-- 쿼리: user_cards WHERE user_id != ? ORDER BY created_at DESC RANGE 0, 4
CREATE INDEX IF NOT EXISTS idx_user_cards_created_at_desc ON public.user_cards(created_at DESC NULLS LAST);
