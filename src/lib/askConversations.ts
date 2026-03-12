import { supabase } from '@/lib/supabase'

export type AskConversationSummary = {
  id: string
  title: string
  updated_at: string
  created_at: string
}

export type AskMessagePayload = {
  steps?: unknown[]
  recommendations?: unknown[]
  outreachTip?: string
  outreachTips?: Record<string, string>
  contactSentCount?: number
  contactSendError?: string
  agentsUsed?: string[]
  agentResponses?: { agent: string; content: string }[]
}

export type AskMessageRow = {
  id: string
  role: 'user' | 'assistant'
  content: string
  payload: AskMessagePayload
  created_at: string
}

/** 사용자의 Ask 대화 목록 (최신순) */
export async function listAskConversations(userId: string): Promise<AskConversationSummary[]> {
  const { data, error } = await supabase
    .from('ask_conversations')
    .select('id, title, updated_at, created_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('[askConversations] list', error.message)
    return []
  }
  return (data ?? []) as AskConversationSummary[]
}

/** 대화 하나 + 메시지 목록 (순서대로) */
export async function getAskConversationWithMessages(
  conversationId: string
): Promise<{ id: string; title: string; messages: AskMessageRow[] } | null> {
  const [convRes, msgRes] = await Promise.all([
    supabase.from('ask_conversations').select('id, title').eq('id', conversationId).single(),
    supabase
      .from('ask_messages')
      .select('id, role, content, payload, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  ])
  if (convRes.error || !convRes.data) return null
  const messages = (msgRes.data ?? []) as AskMessageRow[]
  return { id: convRes.data.id, title: convRes.data.title, messages }
}

/** 새 대화 생성, 제목은 첫 메시지 요약으로 나중에 갱신 가능 */
export async function createAskConversation(userId: string, title?: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('ask_conversations')
    .insert({ user_id: userId, title: title ?? '새 대화' })
    .select('id')
    .single()
  if (error) {
    console.error('[askConversations] create', error.message)
    return null
  }
  return data?.id ?? null
}

/** JSON 직렬화 가능한 payload만 남겨 DB 저장 시 오류 방지 */
function sanitizePayload(payload: AskMessagePayload): AskMessagePayload {
  try {
    return JSON.parse(JSON.stringify(payload ?? {})) as AskMessagePayload
  } catch {
    return {}
  }
}

/** 메시지 추가 (user 또는 assistant). 실패 시 payload 없이 본문만 재시도 */
export async function appendAskMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  payload?: AskMessagePayload
): Promise<string | null> {
  const safePayload = sanitizePayload(payload ?? {})
  const { data, error } = await supabase
    .from('ask_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content: content ?? '',
      payload: safePayload,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[askConversations] appendMessage', error.message, error.code, error.details)
    if (role === 'assistant' && (payload === undefined || Object.keys(safePayload).length > 0)) {
      const retry = await supabase
        .from('ask_messages')
        .insert({
          conversation_id: conversationId,
          role,
          content: content ?? '',
          payload: {},
        })
        .select('id')
        .single()
      if (!retry.error) return retry.data?.id ?? null
      console.error('[askConversations] appendMessage retry (본문만)', retry.error.message)
    }
    return null
  }
  return data?.id ?? null
}

/** assistant 메시지 내용·payload 수정 (진행 중 부분 저장용) */
export async function updateAskMessage(
  messageId: string,
  content: string,
  payload?: AskMessagePayload
): Promise<boolean> {
  const safePayload = sanitizePayload(payload ?? {})
  const { error } = await supabase
    .from('ask_messages')
    .update({ content: content ?? '', payload: safePayload })
    .eq('id', messageId)
  if (error) {
    console.error('[askConversations] updateMessage', error.message, error.code)
    return false
  }
  return true
}

/** 대화 제목 변경 (첫 사용자 메시지로 요약할 때) */
export async function updateAskConversationTitle(
  conversationId: string,
  title: string
): Promise<boolean> {
  const { error } = await supabase
    .from('ask_conversations')
    .update({ title: title.slice(0, 100) })
    .eq('id', conversationId)
  if (error) {
    console.error('[askConversations] updateTitle', error.message)
    return false
  }
  return true
}

/** 대화 삭제 */
export async function deleteAskConversation(conversationId: string): Promise<boolean> {
  const { error } = await supabase.from('ask_conversations').delete().eq('id', conversationId)
  if (error) {
    console.error('[askConversations] delete', error.message)
    return false
  }
  return true
}
