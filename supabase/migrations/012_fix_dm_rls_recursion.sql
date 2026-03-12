-- RLS 무한 재귀 방지: conversation_participants를 참조하는 정책이 같은 테이블을 다시 읽지 않도록
-- SECURITY DEFINER 함수로 "내 대화 ID 목록"을 반환 (정책 평가 시 이 함수만 호출)

CREATE OR REPLACE FUNCTION public.my_conversation_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT conversation_id
  FROM public.conversation_participants
  WHERE user_id = auth.uid();
$$;

-- conversations: 내가 참여한 대화만 조회
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
CREATE POLICY "Users can view conversations they participate in"
  ON public.conversations FOR SELECT
  USING (id IN (SELECT public.my_conversation_ids()));

-- conversation_participants: 내가 참여한 대화의 참여자만 조회 (재귀 제거)
DROP POLICY IF EXISTS "Users can view participants of own conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants of own conversations"
  ON public.conversation_participants FOR SELECT
  USING (conversation_id IN (SELECT public.my_conversation_ids()));

-- messages SELECT: 내 대화의 메시지만 조회
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
CREATE POLICY "Users can view messages in own conversations"
  ON public.messages FOR SELECT
  USING (conversation_id IN (SELECT public.my_conversation_ids()));

-- messages INSERT: 내가 참여한 대화에만 전송
DROP POLICY IF EXISTS "Users can send messages to own conversations" ON public.messages;
CREATE POLICY "Users can send messages to own conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (SELECT public.my_conversation_ids())
  );

-- 정책 평가 시 authenticated가 이 함수를 호출할 수 있도록
GRANT EXECUTE ON FUNCTION public.my_conversation_ids() TO authenticated;
