-- 403 해결: 로그인한 사용자가 모든 명함(user_cards)을 조회할 수 있도록 정책 적용
-- 원인: "Users can view own cards"만 있으면 본인 카드만 보임. Find는 다른 사람 카드를 불러와야 함.
-- Supabase 대시보드 > SQL Editor에서 실행하세요.
-- 참고: 403이 다른 URL(예: /functions/v1/ask-agent)이면 해당 리소스의 인증/권한을 확인하세요.

-- 기존 SELECT 정책 제거 후, "로그인하면 전체 카드 보기" 정책 생성 (여러 번 실행해도 안전)
DROP POLICY IF EXISTS "Users can view own cards" ON public.user_cards;
DROP POLICY IF EXISTS "Authenticated users can view all cards" ON public.user_cards;
CREATE POLICY "Authenticated users can view all cards"
  ON public.user_cards FOR SELECT
  USING (auth.uid() IS NOT NULL);
