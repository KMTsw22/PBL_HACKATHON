import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserCard } from './useUserCards'

export function useDiscoverCards(userId: string | null) {
  const [cards, setCards] = useState<UserCard[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)
  const cardsRef = useRef<UserCard[]>([])
  cardsRef.current = cards

  const fetchMore = useCallback(async () => {
    if (!userId || loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoading(true)
    try {
      const prev = cardsRef.current
      const pageSize = prev.length === 0 ? 3 : 2
      const excludeIds = prev.length > 0 ? prev.map((c) => c.id) : []
      const { data, error } = await supabase.rpc('get_random_discover_cards', {
        p_limit: pageSize,
        p_exclude_ids: excludeIds,
      })
      if (error) throw error
      const fetched = (data as UserCard[]) ?? []
      if (fetched.length > 0) {
        setCards((p) => {
          const existingIds = new Set(p.map((c) => c.id))
          const newOnes = fetched.filter((c) => !existingIds.has(c.id))
          return newOnes.length > 0 ? [...p, ...newOnes] : p
        })
      }
      if (fetched.length < pageSize) setHasMore(false)
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
    loadingRef.current = false
  }, [])

  return { cards, loading, fetchMore, hasMore, retry }
}
