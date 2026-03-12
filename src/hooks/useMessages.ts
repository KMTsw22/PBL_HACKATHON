import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type MessageRow = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
}

export function useMessages(conversationId: string | null, userId: string | null) {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[useMessages] fetch', error.message, error.details)
      setMessages([])
    } else {
      setMessages((data as MessageRow[]) ?? [])
    }
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    setLoading(true)
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    if (!conversationId) return
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as MessageRow])
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!conversationId || !userId || !content.trim()) return
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: content.trim(),
      })
      if (error) {
        console.error('[useMessages] send', error.message, error.details)
      } else {
        fetchMessages()
      }
    },
    [conversationId, userId]
  )

  return { messages, loading, sendMessage, refetch: fetchMessages }
}
