import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserCard } from './useUserCards'

export function useDiscoverCards(userId: string | null) {
  const [cards, setCards] = useState<UserCard[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const offsetRef = useRef(0)
  const loadingRef = useRef(false)

  const fetchMore = useCallback(async () => {
    if (!userId || loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoading(true)
    try {
      const from = offsetRef.current
      const to = from + 19
      const { data, error } = await supabase
        .from('user_cards')
        .select('*')
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      const fetched = (data as UserCard[]) ?? []
      if (fetched.length > 0) {
        const shuffled = [...fetched].sort(() => Math.random() - 0.5)
        setCards((prev) => [...prev, ...shuffled])
        offsetRef.current = to + 1
      }
      if (fetched.length < 20) setHasMore(false)
    } catch {
      setHasMore(false)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [userId, hasMore])

  useEffect(() => {
    if (userId && cards.length === 0 && hasMore) fetchMore()
  }, [userId, cards.length, hasMore, fetchMore])

  const retry = useCallback(() => {
    setHasMore(true)
    setCards([])
    offsetRef.current = 0
    loadingRef.current = false
  }, [])

  return { cards, loading, fetchMore, hasMore, retry }
}
