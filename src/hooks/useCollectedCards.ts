import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserCard } from './useUserCards'

const PAGE_SIZE = 15

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
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const offsetRef = useRef(0)
  const loadingRef = useRef(false)

  const fetchPage = useCallback(
    async (append: boolean) => {
      if (!userId || !supabase.from || loadingRef.current) return
      loadingRef.current = true
      if (!append) {
        setLoading(true)
        offsetRef.current = 0
      } else {
        setLoadingMore(true)
      }
      const from = append ? offsetRef.current : 0
      const to = from + PAGE_SIZE - 1
      const { data: rows, error } = await supabase
        .from('collected_cards')
        .select('id, card_id, created_at, private_notes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('collected_cards fetch error:', error)
        if (!append) setCollected([])
        setHasMore(false)
        setLoading(false)
        setLoadingMore(false)
        loadingRef.current = false
        return
      }

      const list = rows ?? []
      if (list.length < PAGE_SIZE) setHasMore(false)
      if (list.length === 0) {
        if (!append) setCollected([])
        setLoading(false)
        setLoadingMore(false)
        loadingRef.current = false
        return
      }

      const collectedIds = list.map((r) => r.id)
      const cardIds = list.map((r) => r.card_id).filter(Boolean)

      const [cardsRes, scoresRes] = await Promise.all([
        cardIds.length > 0 ? supabase.from('user_cards').select('*').in('id', cardIds) : { data: [] },
        collectedIds.length > 0
          ? supabase.from('collected_card_scores').select('collected_card_id, category, score, is_ai_suggested').in('collected_card_id', collectedIds)
          : { data: [] },
      ])

      const cards = (cardsRes.data ?? []) as UserCard[]
      const scoresRows = (scoresRes.data ?? []) as { collected_card_id: string; category: string; score: number; is_ai_suggested: boolean }[]
      const cardMap = new Map(cards.map((c) => [c.id, c as UserCard]))
      const scoresByCollected = new Map<string, CollectedScore[]>()
      for (const s of scoresRows) {
        const arr = scoresByCollected.get(s.collected_card_id) ?? []
        arr.push({
          category: s.category,
          score: Number(s.score),
          is_ai_suggested: s.is_ai_suggested ?? false,
        })
        scoresByCollected.set(s.collected_card_id, arr)
      }

      const result: CollectedCard[] = list.map((r) => ({
        id: r.id,
        card_id: r.card_id,
        created_at: r.created_at,
        private_notes: r.private_notes ?? null,
        user_cards: cardMap.get(r.card_id) ?? null,
        scores: scoresByCollected.get(r.id) ?? [],
      }))

      if (append) {
        setCollected((prev) => {
          const existingIds = new Set(prev.map((c) => c.id))
          const newOnes = result.filter((c) => !existingIds.has(c.id))
          return newOnes.length > 0 ? [...prev, ...newOnes] : prev
        })
      } else {
        setCollected(result)
      }
      offsetRef.current = to + 1
      setLoading(false)
      setLoadingMore(false)
      loadingRef.current = false
    },
    [userId]
  )

  useEffect(() => {
    if (!userId) {
      setCollected([])
      setLoading(false)
      setHasMore(true)
      offsetRef.current = 0
      return
    }
    fetchPage(false)
  }, [userId, fetchPage])

  const fetchMore = useCallback(() => {
    if (hasMore && !loadingRef.current) fetchPage(true)
  }, [hasMore, fetchPage])

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
      fetchPage(false)
    },
    [userId, fetchPage]
  )

  const removeCollect = useCallback(
    async (cardId: string) => {
      if (!userId || !supabase.from) return
      await supabase
        .from('collected_cards')
        .delete()
        .eq('user_id', userId)
        .eq('card_id', cardId)
      setCollected((prev) => prev.filter((c) => c.card_id !== cardId))
    },
    [userId]
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
      setCollected((prev) =>
        prev.map((c) =>
          c.id !== collectedCardId
            ? c
            : {
                ...c,
                private_notes: data.privateNotes ?? c.private_notes,
                scores: data.scores.map((s) => ({ category: s.category, score: s.score, is_ai_suggested: s.isAiSuggested ?? false })),
              }
        )
      )
    },
    [userId]
  )

  const isCollected = useCallback(
    (cardId: string) => collected.some((c) => c.card_id === cardId),
    [collected]
  )

  const collectedIds = new Set(collected.map((c) => c.card_id))

  return {
    collected,
    loading,
    loadingMore,
    hasMore,
    fetchMore,
    addCollect,
    removeCollect,
    updateRatings,
    isCollected,
    collectedIds,
    refetch: () => fetchPage(false),
  }
}
