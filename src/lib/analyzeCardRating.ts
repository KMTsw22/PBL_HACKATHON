import { supabase } from '@/lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export type CardForAnalysis = {
  card_name?: string | null
  description?: string | null
  custom_title?: string | null
  custom_content?: string | null
}

export type AiSuggestion = {
  category: string
  score: number
  reason?: string
}

export async function analyzeCardForRating(card: CardForAnalysis): Promise<AiSuggestion[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('로그인이 필요합니다.')

  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-card-rating`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY ?? '',
    },
    body: JSON.stringify({
      card_name: card.card_name ?? null,
      description: card.description ?? null,
      custom_title: card.custom_title ?? null,
      custom_content: card.custom_content ?? null,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.message || err.error || `AI 분석 실패 (${res.status})`
    throw new Error(typeof msg === 'string' ? msg : 'AI 분석에 실패했습니다.')
  }

  const json = await res.json()
  const suggestions = json?.suggestions ?? []
  if (!Array.isArray(suggestions)) {
    throw new Error('잘못된 AI 응답입니다.')
  }
  return suggestions
}
