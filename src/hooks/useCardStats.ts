import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type CardStats = {
  totalCollectionsCount: number
  cardCollectedCounts: Record<string, number>
}

export function useCardStats(userId: string | null, myCardIds: string[]) {
  const [stats, setStats] = useState<CardStats>({
    totalCollectionsCount: 0,
    cardCollectedCounts: {},
  })
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!userId || !supabase.from || myCardIds.length === 0) {
      setStats({ totalCollectionsCount: 0, cardCollectedCounts: {} })
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('collected_cards')
      .select('card_id, user_id')
      .in('card_id', myCardIds)

    if (error) {
      console.error('card stats fetch error:', error)
      setStats({ totalCollectionsCount: 0, cardCollectedCounts: {} })
      setLoading(false)
      return
    }

    const rows = data ?? []
    const countsByCard: Record<string, number> = {}
    let total = 0

    for (const row of rows) {
      countsByCard[row.card_id] = (countsByCard[row.card_id] ?? 0) + 1
      total += 1
    }

    setStats({
      totalCollectionsCount: total,
      cardCollectedCounts: countsByCard,
    })
    setLoading(false)
  }, [userId, myCardIds.join(',')])

  useEffect(() => {
    if (!userId) {
      setStats({ totalCollectionsCount: 0, cardCollectedCounts: {} })
      setLoading(false)
      return
    }
    setLoading(true)
    fetchStats()
  }, [userId, fetchStats])

  const getCardCollectedCount = useCallback(
    (cardId: string) => stats.cardCollectedCounts[cardId] ?? 0,
    [stats.cardCollectedCounts]
  )

  return {
    totalCollectionsCount: stats.totalCollectionsCount,
    cardCollectedCounts: stats.cardCollectedCounts,
    getCardCollectedCount,
    loading,
    refetch: fetchStats,
  }
}
