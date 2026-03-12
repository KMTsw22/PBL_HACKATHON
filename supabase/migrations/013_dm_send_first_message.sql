-- DM 생성 후 첫 메시지까지 한 번에 전송 (클라이언트 RLS 타이밍 이슈 방지)
CREATE OR REPLACE FUNCTION public.get_or_create_dm_and_send_message(
  other_user_id UUID,
  initial_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_id UUID := auth.uid();
  conv_id UUID;
  existing_id UUID;
BEGIN
  IF my_id IS NULL OR other_user_id IS NULL OR my_id = other_user_id THEN
    RETURN NULL;
  END IF;

  -- 기존 1:1 대화 찾기
  SELECT c.id INTO existing_id
  FROM conversations c
  JOIN conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = my_id
  JOIN conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = other_user_id
  WHERE (SELECT count(*) FROM conversation_participants WHERE conversation_id = c.id) = 2
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    conv_id := existing_id;
  ELSE
    INSERT INTO conversations (id) VALUES (DEFAULT) RETURNING id INTO conv_id;
    INSERT INTO conversation_participants (conversation_id, user_id) VALUES (conv_id, my_id);
    INSERT INTO conversation_participants (conversation_id, user_id) VALUES (conv_id, other_user_id);
  END IF;

  -- 첫 메시지가 있으면 전송
  IF initial_message IS NOT NULL AND trim(initial_message) <> '' THEN
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (conv_id, my_id, trim(initial_message));
  END IF;

  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_dm_and_send_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_and_send_message(UUID, TEXT) TO service_role;
