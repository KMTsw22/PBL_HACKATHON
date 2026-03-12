import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Find 페이지용: 수집한 카드 id만 가벼운 1회 요청으로 가져옴.
 * useCollectedCards 전체를 쓰면 수백 장일 때 청크 요청이 많아져 첫 3장 로딩이 느려짐.
 */
export function useCollectedCardIds(userId: string | null) {
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!userId || !supabase.from) {
      setCollectedIds(new Set())
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('collected_cards')
      .select('card_id')
      .eq('user_id', userId)
    if (error) {
      console.error('collected_cards (ids) fetch error:', error)
      setCollectedIds(new Set())
    } else {
      const ids = (data ?? []).map((r) => r.card_id).filter(Boolean)
      setCollectedIds(new Set(ids))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setCollectedIds(new Set())
      setLoading(false)
      return
    }
    setLoading(true)
    refetch()
  }, [userId, refetch])

  const addCollect = useCallback(
    async (
      cardId: string,
      options?: { privateNotes?: string; scores?: { category: string; score: number; isAiSuggested?: boolean }[] }
    ) => {
      if (!userId || !supabase.from) throw new Error('로그인이 필요합니다.')
      const { data: inserted, error } = await supabase
        .from('collected_cards')
        .insert({
          user_id: userId,
          card_id: cardId,
          private_notes: options?.privateNotes ?? null,
        })
        .select('id')
        .single()
      if (error) throw error

      const scores = options?.scores ?? []
      if (scores.length > 0 && inserted?.id) {
        const scoreRows = scores.map((s) => ({
          collected_card_id: inserted.id,
          category: s.category,
          score: s.score,
          is_ai_suggested: s.isAiSuggested ?? false,
        }))
        await supabase.from('collected_card_scores').insert(scoreRows)
      }
      setCollectedIds((prev) => new Set([...prev, cardId]))
    },
    [userId]
  )

  return { collectedIds, loading, addCollect, refetch }
}
