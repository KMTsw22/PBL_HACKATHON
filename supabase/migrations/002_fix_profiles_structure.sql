-- profiles 테이블: 프로필 정보만 (카드 정보 제외)
-- profiles에 카드 관련 컬럼이 있다면 제거

-- 카드 관련 컬럼 제거 (있을 경우에만)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS card_name;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS card_image;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS description;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS custom_title;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS custom_content;

-- profiles: 사용자 프로필만
-- user_cards: 카드 정보 (user_id로 연결)
