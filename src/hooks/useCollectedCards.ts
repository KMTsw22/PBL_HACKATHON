import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserCard } from './useUserCards'

export type CollectedScore = {
  category: string
  score: number
  is_ai_suggested: boolean
}

export type CollectedCard = {
  id: string
  card_id: string
  created_at: string
  private_notes: string | null
  user_cards: UserCard | null
  scores: CollectedScore[]
}

export function useCollectedCards(userId: string | null) {
  const [collected, setCollected] = useState<CollectedCard[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCollected = useCallback(async () => {
    if (!userId || !supabase.from) {
      setCollected([])
      setLoading(false)
      return
    }
    const { data: rows, error } = await supabase
      .from('collected_cards')
      .select('id, card_id, created_at, private_notes')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('collected_cards fetch error:', error)
      setCollected([])
      setLoading(false)
      return
    }

    const collectedIds = (rows ?? []).map((r) => r.id)
    const cardIds = (rows ?? []).map((r) => r.card_id).filter(Boolean)

    const [cardsRes, scoresRes] = await Promise.all([
      cardIds.length > 0
        ? supabase.from('user_cards').select('*').in('id', cardIds)
        : Promise.resolve({ data: [] }),
      collectedIds.length > 0
        ? supabase.from('collected_card_scores').select('collected_card_id, category, score, is_ai_suggested').in('collected_card_id', collectedIds)
        : Promise.resolve({ data: [] }),
    ])

    const cards = cardsRes.data ?? []
    const scoresRows = scoresRes.data ?? []
    const cardMap = new Map(cards.map((c) => [c.id, c as UserCard]))
    const scoresByCollected = new Map<string, CollectedScore[]>()
    for (const s of scoresRows) {
      const list = scoresByCollected.get(s.collected_card_id) ?? []
      list.push({
        category: s.category,
        score: Number(s.score),
        is_ai_suggested: s.is_ai_suggested ?? false,
      })
      scoresByCollected.set(s.collected_card_id, list)
    }

    const result: CollectedCard[] = (rows ?? []).map((r) => ({
      id: r.id,
      card_id: r.card_id,
      created_at: r.created_at,
      private_notes: r.private_notes ?? null,
      user_cards: cardMap.get(r.card_id) ?? null,
      scores: scoresByCollected.get(r.id) ?? [],
    }))
    setCollected(result)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setCollected([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetchCollected()
  }, [userId, fetchCollected])

  const addCollect = useCallback(
    async (cardId: string, options?: { privateNotes?: string; scores?: { category: string; score: number; isAiSuggested?: boolean }[] }) => {
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
      fetchCollected()
    },
    [userId, fetchCollected]
  )

  const removeCollect = useCallback(
    async (cardId: string) => {
      if (!userId || !supabase.from) return
      await supabase
        .from('collected_cards')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', cardId)
      fetchCollected()
    },
    [userId, fetchCollected]
  )

  const updateRatings = useCallback(
    async (
      collectedCardId: string,
      data: { privateNotes?: string; scores?: { category: string; score: number; isAiSuggested?: boolean }[] }
    ) => {
      if (!userId || !supabase.from) throw new Error('로그인이 필요합니다.')

      if (data.privateNotes !== undefined) {
        await supabase
          .from('collected_cards')
          .update({ private_notes: data.privateNotes || null })
          .eq('id', collectedCardId)
          .eq('user_id', userId)
      }

      if (data.scores && data.scores.length > 0) {
        await supabase.from('collected_card_scores').delete().eq('collected_card_id', collectedCardId)
        const scoreRows = data.scores.map((s) => ({
          collected_card_id: collectedCardId,
          category: s.category,
          score: s.score,
          is_ai_suggested: s.isAiSuggested ?? false,
        }))
        await supabase.from('collected_card_scores').insert(scoreRows)
      }
      fetchCollected()
    },
    [userId, fetchCollected]
  )

  const isCollected = useCallback(
    (cardId: string) => collected.some((c) => c.card_id === cardId),
    [collected]
  )

  const collectedIds = new Set(collected.map((c) => c.card_id))

  return {
    collected,
    loading,
    addCollect,
    removeCollect,
    updateRatings,
    isCollected,
    collectedIds,
    refetch: fetchCollected,
  }
}
