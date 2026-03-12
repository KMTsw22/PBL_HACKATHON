-- Ask(에이전트) 대화 저장: 대화 목록 + 메시지 (ChatGPT 스타일 기록 보기)

-- 대화 목록 (사용자별)
CREATE TABLE IF NOT EXISTS public.ask_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '새 대화',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ask_conversations_user_id ON public.ask_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ask_conversations_updated_at ON public.ask_conversations(user_id, updated_at DESC);

ALTER TABLE public.ask_conversations ENABLE ROW LEVEL SECURITY;

-- 메시지 (role + content + payload로 에이전트 steps/추천 등 복원)
CREATE TABLE IF NOT EXISTS public.ask_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ask_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL DEFAULT '',
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ask_messages_conversation_id ON public.ask_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ask_messages_created_at ON public.ask_messages(conversation_id, created_at ASC);

ALTER TABLE public.ask_messages ENABLE ROW LEVEL SECURITY;

-- RLS: 본인 대화만
DROP POLICY IF EXISTS "Users can view own ask conversations" ON public.ask_conversations;
CREATE POLICY "Users can view own ask conversations"
  ON public.ask_conversations FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own ask messages" ON public.ask_messages;
CREATE POLICY "Users can view own ask messages"
  ON public.ask_messages FOR ALL
  USING (
    conversation_id IN (SELECT id FROM public.ask_conversations WHERE user_id = auth.uid())
  )
  WITH CHECK (
    conversation_id IN (SELECT id FROM public.ask_conversations WHERE user_id = auth.uid())
  );

-- 새 메시지 시 대화 updated_at 갱신
CREATE OR REPLACE FUNCTION public.update_ask_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.ask_conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ask_message_insert_update_conversation ON public.ask_messages;
CREATE TRIGGER on_ask_message_insert_update_conversation
  AFTER INSERT ON public.ask_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_ask_conversation_updated_at();
