import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type UserCard = {
  id: string
  user_id: string
  card_name: string | null
  description: string | null
  custom_title: string | null
  custom_content: string | null
  image_url: string
  portfolio_url: string | null
  email: string | null
  kakao_id: string | null
  phone: string | null
  created_at: string
}

export function useUserCards(userId: string | null) {
  const [cards, setCards] = useState<UserCard[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCards = useCallback(async () => {
    if (!userId || !supabase.from) {
      setCards([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('user_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (!error) setCards((data as UserCard[]) ?? [])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setCards([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetchCards()
  }, [userId, fetchCards])

  const addCard = useCallback(
    async (card: Omit<UserCard, 'id' | 'user_id' | 'created_at'>) => {
      if (!userId || !supabase.from) throw new Error('로그인이 필요합니다.')
      const { data, error } = await supabase
        .from('user_cards')
        .insert({
          user_id: userId,
          card_name: card.card_name,
          description: card.description,
          custom_title: card.custom_title,
          custom_content: card.custom_content,
          image_url: card.image_url,
          portfolio_url: card.portfolio_url ?? null,
          email: card.email ?? null,
          kakao_id: card.kakao_id ?? null,
          phone: card.phone ?? null,
        })
        .select()
        .single()
      if (error) throw error
      fetchCards()
      return data as UserCard
    },
    [userId, fetchCards]
  )

  const updateCard = useCallback(
    async (cardId: string, card: Omit<UserCard, 'id' | 'user_id' | 'created_at'>) => {
      if (!userId || !supabase.from) throw new Error('로그인이 필요합니다.')
      const { error } = await supabase
        .from('user_cards')
        .update({
          card_name: card.card_name,
          description: card.description,
          custom_title: card.custom_title,
          custom_content: card.custom_content,
          image_url: card.image_url,
          portfolio_url: card.portfolio_url ?? null,
          email: card.email ?? null,
          kakao_id: card.kakao_id ?? null,
          phone: card.phone ?? null,
        })
        .eq('id', cardId)
        .eq('user_id', userId)
      if (error) throw error
      fetchCards()
    },
    [userId, fetchCards]
  )

  const deleteCard = useCallback(
    async (cardId: string) => {
      if (!supabase.from) return
      await supabase.from('user_cards').delete().eq('id', cardId)
      fetchCards()
    },
    [fetchCards]
  )

  return { cards, loading, addCard, updateCard, deleteCard, refetch: fetchCards }
}
