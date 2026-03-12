import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const PAGE_SIZE = 15

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
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(true)
  const loadingOlderRef = useRef(false)

  const fetchInitial = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      setHasMoreOlder(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)

    if (error) {
      console.error('[useMessages] fetch', error.message, error.details)
      setMessages([])
      setHasMoreOlder(false)
    } else {
      const list = (data as MessageRow[]) ?? []
      setMessages([...list].reverse())
      setHasMoreOlder(list.length >= PAGE_SIZE)
    }
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    fetchInitial()
  }, [fetchInitial])

  const loadMoreOlder = useCallback(async () => {
    if (!conversationId || loadingOlderRef.current || !hasMoreOlder) return
    const oldest = messages[0]
    if (!oldest) return
    loadingOlderRef.current = true
    setLoadingOlder(true)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at')
        .eq('conversation_id', conversationId)
        .lt('created_at', oldest.created_at)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1)

      if (error) throw error
      const list = (data as MessageRow[]) ?? []
      if (list.length > 0) {
        setMessages((prev) => [...list].reverse().concat(prev))
      }
      if (list.length < PAGE_SIZE) setHasMoreOlder(false)
    } catch (e) {
      console.error('[useMessages] loadMoreOlder', e)
      setHasMoreOlder(false)
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [conversationId, messages, hasMoreOlder])

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
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: content.trim(),
        })
        .select('id, conversation_id, sender_id, content, created_at')
        .single()

      if (error) {
        console.error('[useMessages] send', error.message, error.details)
      } else if (data) {
        setMessages((prev) => [...prev, data as MessageRow])
      }
    },
    [conversationId, userId]
  )

  return { messages, loading, loadingOlder, hasMoreOlder, loadMoreOlder, sendMessage, refetch: fetchInitial }
}
