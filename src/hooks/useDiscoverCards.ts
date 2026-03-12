import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserCard } from './useUserCards'

type Options = { collectedReady?: boolean }

/** collectedIds: 이미 수집한 카드 id. DB에서부터 제외. collectedReady: true일 때만 첫 요청 (수집 목록 로딩 완료 후). */
export function useDiscoverCards(userId: string | null, collectedIds: Set<string> = new Set(), options: Options = {}) {
  const { collectedReady = true } = options
  const [cards, setCards] = useState<UserCard[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)
  const cardsRef = useRef<UserCard[]>([])
  cardsRef.current = cards
  const collectedIdsRef = useRef(collectedIds)
  collectedIdsRef.current = collectedIds

  const fetchMore = useCallback(async () => {
    if (!userId || loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoading(true)
    try {
      const prev = cardsRef.current
      const pageSize = prev.length === 0 ? 3 : 2
      const alreadyShown = prev.map((c) => c.id)
      const collected = Array.from(collectedIdsRef.current)
      const excludeIds = [...new Set([...alreadyShown, ...collected])]
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
    if (userId && collectedReady && cards.length === 0 && hasMore) fetchMore()
  }, [userId, collectedReady, cards.length, hasMore, fetchMore])

  const retry = useCallback(() => {
    setHasMore(true)
    setCards([])
    loadingRef.current = false
  }, [])

  return { cards, loading, fetchMore, hasMore, retry }
}
