import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export type Profile = {
  id: string
  name: string | null
  major: string | null
  experience: string | null
  photo_url: string | null
}

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async () => {
    if (!user?.id || !supabase.from) return
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (data) {
      const photoFromDb = data.photo_url ?? data.avatar_url ?? data.picture ?? null
      const photoFromAuth = user?.user_metadata?.picture ?? user?.user_metadata?.avatar_url ?? null
      const photo_url = photoFromDb ?? photoFromAuth

      if (!photoFromDb && photoFromAuth) {
        await supabase.from('profiles').update({ photo_url: photoFromAuth }).eq('id', user!.id)
      }

      setProfile({
        id: data.id,
        name: data.name ?? data.full_name ?? null,
        major: data.major ?? null,
        experience: data.experience ?? null,
        photo_url,
      })
    } else if (error) {
      console.error('[useProfile]', error)
    }
    if (!data && !error) {
      // 프로필 없음 → 카카오 메타데이터로 생성
      const name = user.user_metadata?.full_name ?? user.user_metadata?.user_name ?? user.user_metadata?.name ?? null
      const photo_url = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null
      const { data: upserted } = await supabase
        .from('profiles')
        .upsert({ id: user.id, name, photo_url }, { onConflict: 'id' })
        .select()
        .single()
      setProfile((upserted as Profile) ?? { id: user.id, name, major: null, experience: null, photo_url })
    } else {
      setProfile(null)
    }
    setLoading(false)
  }, [user?.id, user?.user_metadata])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    fetchProfile()
  }, [user, fetchProfile])

  return { profile, loading, refetch: fetchProfile }
}
