import { supabase } from '@/lib/supabase'

export type ConversationWithMeta = {
  id: string
  updated_at: string
  other_user: { id: string; name: string | null; photo_url: string | null }
  last_message: { content: string; created_at: string; sender_id: string } | null
  unread_count?: number
}

/** 1:1 대화 ID 가져오기 또는 생성 */
export async function getOrCreateDmConversation(otherUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_dm_conversation', {
    other_user_id: otherUserId,
  })
  if (error) {
    console.error('[getOrCreateDmConversation]', error.message, error.details)
    return null
  }
  return data as string | null
}

/** 1:1 대화 생성/조회 후 첫 메시지까지 서버에서 전송 (연락이 바로 감). 실패 시 { convId: null, error } 반환. */
export async function getOrCreateDmAndSendMessage(
  otherUserId: string,
  initialMessage: string | null | undefined
): Promise<{ convId: string | null; error?: string }> {
  const { data, error } = await supabase.rpc('get_or_create_dm_and_send_message', {
    other_user_id: otherUserId,
    initial_message: initialMessage ?? null,
  })
  if (error) {
    console.error('[getOrCreateDmAndSendMessage]', error.message, error.details)
    return { convId: null, error: error.message }
  }
  return { convId: data as string | null }
}
