import { supabase } from '@/lib/supabase'
import type { UserCard } from '@/hooks/useUserCards'

export type RecommendResult = {
  card: UserCard
  reason: string
}

export type RecommendResponse = {
  recommendations: RecommendResult[]
  cards: UserCard[]
  message: string
}

export async function recommendFromCollected(query: string): Promise<RecommendResponse> {
  const { data, error } = await supabase.functions.invoke('recommend-from-collected', {
    body: { query: query.trim() },
  })

  if (error) {
    const errBody = typeof data === 'object' && data !== null && 'message' in data ? (data as { message: string }).message : null
    throw new Error(errBody ?? error.message ?? '추천을 불러오지 못했어요.')
  }

  const json = (typeof data === 'object' && data !== null ? data : {}) as {
    recommendations?: { card: UserCard; reason: string }[]
    cards?: UserCard[]
    message?: string
  }
  const recs = json.recommendations ?? []
  const cards = json.cards ?? []
  const message = json.message ?? ''

  return {
    recommendations: recs.map((r) => ({ card: r.card, reason: r.reason || '' })),
    cards,
    message,
  }
}
