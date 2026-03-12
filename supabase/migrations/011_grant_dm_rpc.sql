-- RPC 호출 권한: 로그인한 사용자가 DM 대화 생성/조회 가능
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_conversation(UUID) TO service_role;
