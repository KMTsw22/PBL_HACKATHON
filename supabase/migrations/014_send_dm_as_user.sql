-- 서버(Edge Function 등)에서 특정 사용자(sender) 대신 DM 생성 + 첫 메시지 전송 (연락 일괄 발송용)
-- 파라미터 순서: Supabase RPC가 객체 키 알파벳 순(initial_message, other_user_id, sender_id)으로 찾으므로 동일하게 정의
DROP FUNCTION IF EXISTS public.send_dm_as_user(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.send_dm_as_user(
  initial_message TEXT DEFAULT NULL,
  other_user_id UUID,
  sender_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id UUID;
  existing_id UUID;
BEGIN
  IF sender_id IS NULL OR other_user_id IS NULL OR sender_id = other_user_id THEN
    RETURN NULL;
  END IF;

  -- 기존 1:1 대화 찾기
  SELECT c.id INTO existing_id
  FROM conversations c
  JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = sender_id
  JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = other_user_id
  WHERE (SELECT count(*) FROM conversation_participants WHERE conversation_id = c.id) = 2
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    conv_id := existing_id;
  ELSE
    INSERT INTO conversations (id) VALUES (DEFAULT) RETURNING id INTO conv_id;
    INSERT INTO conversation_participants (conversation_id, user_id) VALUES (conv_id, sender_id);
    INSERT INTO conversation_participants (conversation_id, user_id) VALUES (conv_id, other_user_id);
  END IF;

  IF initial_message IS NOT NULL AND trim(initial_message) <> '' THEN
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (conv_id, sender_id, trim(initial_message));
  END IF;

  RETURN conv_id;
END;
$$;

-- 서버(service_role)에서만 호출 가능 (시그니처: initial_message, other_user_id, sender_id)
GRANT EXECUTE ON FUNCTION public.send_dm_as_user(TEXT, UUID, UUID) TO service_role;
