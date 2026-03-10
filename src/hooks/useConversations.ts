import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ConversationWithMeta } from '@/lib/chat'

export function useConversations(userId: string | null) {
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    if (!userId) {
      setConversations([])
      setLoading(false)
      return
    }
    const { data: convList, error: convError } = await supabase
      .from('conversations')
      .select('id, updated_at')
      .order('updated_at', { ascending: false })

    if (convError || !convList?.length) {
      setConversations([])
      setLoading(false)
      return
    }

    const convIds = convList.map((c) => c.id)
    const [participantsRes, messagesRes] = await Promise.all([
      supabase.from('conversation_participants').select('conversation_id, user_id').in('conversation_id', convIds),
      supabase
        .from('messages')
        .select('conversation_id, content, created_at, sender_id')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false }),
    ])

    const participants = participantsRes.data ?? []
    const messages = messagesRes.data ?? []

    const otherUserIds = new Set<string>()
    participants.forEach((p) => {
      if (p.user_id !== userId) otherUserIds.add(p.user_id)
    })
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, photo_url')
      .in('id', Array.from(otherUserIds))

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
    const lastByConv = new Map<string | undefined, { content: string; created_at: string; sender_id: string }>()
    messages.forEach((m) => {
      if (!lastByConv.has(m.conversation_id)) lastByConv.set(m.conversation_id, m as { content: string; created_at: string; sender_id: string })
    })

    const otherByConv = new Map<string, { id: string; name: string | null; photo_url: string | null }>()
    participants.forEach((p) => {
      if (p.user_id !== userId) {
        const prof = profileMap.get(p.user_id)
        otherByConv.set(p.conversation_id, {
          id: p.user_id,
          name: prof?.name ?? null,
          photo_url: prof?.photo_url ?? null,
        })
      }
    })

    const list: ConversationWithMeta[] = convList.map((c) => ({
      id: c.id,
      updated_at: c.updated_at,
      other_user: otherByConv.get(c.id) ?? { id: '', name: null, photo_url: null },
      last_message: lastByConv.get(c.id) ?? null,
    }))
    setConversations(list)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => { fetchConversations() }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchConversations])

  return { conversations, loading, refetch: fetchConversations }
}
