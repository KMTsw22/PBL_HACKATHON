import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserCard } from './useUserCards'

/** DB에서 auth.uid()로 본인·수집 카드 제외 후 무작위 N장 반환. 인자는 p_limit만 넘김. */
export function useDiscoverCards(userId: string | null) {
  const [cards, setCards] = useState<UserCard[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const loadingRef = useRef(false)
  const cardsRef = useRef<UserCard[]>([])
  cardsRef.current = cards

  const fetchMore = useCallback(async () => {
    if (!userId) {
      console.debug('[Find] useDiscoverCards fetchMore 스킵: userId 없음')
      return
    }
    if (loadingRef.current) {
      console.debug('[Find] useDiscoverCards fetchMore 스킵: 이미 로딩 중')
      return
    }
    if (!hasMore) {
      console.debug('[Find] useDiscoverCards fetchMore 스킵: hasMore false')
      return
    }
    loadingRef.current = true
    setLoading(true)
    const prev = cardsRef.current
    const pageSize = prev.length === 0 ? 3 : 2
    console.log('[Find] useDiscoverCards RPC 요청 시작', { userId: userId.slice(0, 8), pageSize, 기존카드수: prev.length })
    try {
      const { data, error } = await supabase.rpc('get_random_discover_cards', {
        p_limit: pageSize,
        p_exclude_ids: [],
      })
      if (error) {
        console.error('[Find] useDiscoverCards get_random_discover_cards error:', error.message, error.code)
        throw error
      }
      const fetched = Array.isArray(data) ? (data as UserCard[]) : []
      console.log('[Find] useDiscoverCards RPC 응답', { 받은개수: fetched.length, ids: fetched.map((c) => c.id?.slice(0, 8)), rawType: Array.isArray(data) ? 'array' : typeof data })
      const prev = cardsRef.current
      const existingIds = new Set(prev.map((c) => c.id))
      const newOnes = fetched.filter((c) => !existingIds.has(c.id))
      if (newOnes.length > 0) {
        setCards((p) => [...p, ...newOnes])
      }
      // 더 없음: 받은 개수 부족하거나, 받은 게 전부 기존과 중복일 때
      if (fetched.length < pageSize || (fetched.length > 0 && newOnes.length === 0)) {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [userId, hasMore])

  useEffect(() => {
    if (userId && cards.length === 0 && hasMore) {
      console.log('[Find] useDiscoverCards 초기 fetch 트리거', { userId: userId.slice(0, 8) })
      fetchMore()
    }
  }, [userId, cards.length, hasMore, fetchMore])

  const retry = useCallback(() => {
    setHasMore(true)
    setCards([])
    loadingRef.current = false
  }, [])

  return { cards, loading, fetchMore, hasMore, retry }
}
