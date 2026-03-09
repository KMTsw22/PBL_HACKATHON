import { supabase } from '@/lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export type GenerateCardImageParams = {
  cardName?: string
  description: string
  customTitle?: string
  customContent?: string
  userId?: string
}

export async function generateCardImage(params: GenerateCardImageParams): Promise<string> {
  const { cardName, description, customTitle, customContent, userId } = params
  if (!description || typeof description !== 'string') {
    throw new Error('카드 설명을 입력해주세요.')
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('로그인이 필요합니다.')

  const body = {
    cardName: cardName || undefined,
    description: description.trim(),
    customTitle: customTitle || undefined,
    customContent: customContent || undefined,
    userId: userId || undefined,
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.message || err.error || `이미지 생성 실패 (${res.status})`
    throw new Error(typeof msg === 'string' ? msg : '이미지 생성에 실패했습니다.')
  }

  const json = await res.json()
  const imageUrl = json?.imageUrl ?? json?.url
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error(json?.error || '이미지 URL을 받지 못했습니다.')
  }
  return imageUrl
}
