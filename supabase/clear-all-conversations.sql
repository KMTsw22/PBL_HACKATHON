-- 지금까지의 모든 대화방·대화 삭제
-- 실행: Supabase 대시보드 → SQL Editor에서 실행

DELETE FROM public.messages;
DELETE FROM public.conversation_participants;
DELETE FROM public.conversations;
