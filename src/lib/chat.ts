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
  if (error) return null
  return data as string | null
}
