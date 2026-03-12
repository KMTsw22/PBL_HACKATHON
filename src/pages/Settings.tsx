import { useState } from 'react'
import { CardImage } from '@/components/CardImage'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'

export default function Settings() {
  const { user } = useAuth()
  const { profile } = useProfile(user)
  const [collecting, setCollecting] = useState(false)
  const [collectMessage, setCollectMessage] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    setDeleteError(null)
    setDeleting(true)
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: {} })
      if (error) {
        setDeleteError(error.message || '계정 삭제에 실패했습니다.')
        return
      }
      const result = data as { ok?: boolean; message?: string }
      if (!result?.ok) {
        setDeleteError(result?.message || '계정 삭제에 실패했습니다.')
        return
      }
      setShowDeleteConfirm(false)
      await supabase.auth.signOut()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : '계정 삭제 중 오류가 났어요.')
    } finally {
      setDeleting(false)
    }
  }

  const handleCollectAllSeedCards = async () => {
    if (!user) return
    setCollectMessage(null)
    setCollecting(true)
    try {
      const { data } = await supabase.rpc('collect_all_seed_cards')
      const result = data as { ok?: boolean; error?: string; collected_count?: number; newly_inserted?: number } | null
      if (result?.ok) {
        setCollectMessage(
          `수집 완료. 총 ${result.collected_count ?? 0}장 보유, 이번에 ${result.newly_inserted ?? 0}장 추가됐어요.`
        )
      } else {
        setCollectMessage(result?.error ?? '수집에 실패했어요.')
      }
    } catch (e) {
      setCollectMessage(e instanceof Error ? e.message : '수집 중 오류가 났어요.')
    } finally {
      setCollecting(false)
    }
  }

  const displayName = profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.user_name || 'John Doe'

  const ListItem = ({
    icon,
    label,
    sublabel,
    onClick,
  }: {
    icon: React.ReactNode
    label: string
    sublabel?: string
    onClick?: () => void
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:bg-gray-50"
    >
      <span className="text-gray-600">{icon}</span>
      <div className="flex-1 text-left">
        <p className="font-medium text-gray-900">{label}</p>
        {sublabel && <p className="text-sm text-gray-500">{sublabel}</p>}
      </div>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )

  return (
    <div className="min-h-full bg-[#FAF8F6] px-4 pt-4 pb-8">
      <header className="flex items-center gap-4 mb-6">
        <button type="button" className="text-gray-700">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Settings</h1>
      </header>

      <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-[#FFE4E0] mb-6">
        <div className="w-14 h-14 rounded-full bg-[#FFE4E0] flex items-center justify-center overflow-hidden">
          <CardImage
            imageUrl={profile?.photo_url ?? ''}
            name={displayName}
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <div className="flex-1">
          <p className="font-bold text-gray-900">{displayName}</p>
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <span className="text-[#FF9C8F]">✓</span> Global Agent Active
          </p>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-[#FF9C8F] text-white text-sm font-medium rounded-xl"
        >
          Edit Profile
        </button>
      </div>

      <section className="mb-6">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">데모 · 체험</h2>
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleCollectAllSeedCards}
            disabled={collecting || !user}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[#FF9C8F]/40 bg-[#FFE4E0]/60 hover:bg-[#FFE4E0] hover:border-[#FF9C8F]/60 disabled:opacity-50 transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-[#FF9C8F]/20 flex items-center justify-center flex-shrink-0 text-[#FF9C8F]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <div className="flex-1 text-left min-w-0">
              <p className="font-semibold text-[#C75A4F]">전체 명함 한 번에 수집</p>
              <p className="text-sm text-gray-600 mt-0.5">허수아비 카드들만 추가됨 (Ask·추천 체험용)</p>
            </div>
            {collecting ? <span className="text-sm font-medium text-[#FF9C8F] flex-shrink-0">처리 중...</span> : <span className="text-[#FF9C8F] flex-shrink-0" aria-hidden>→</span>}
          </button>
          {collectMessage && (
            <p className="text-sm px-4 py-2 rounded-lg bg-[#FFE4E0]/50 text-gray-700">{collectMessage}</p>
          )}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Account</h2>
        <div className="space-y-2">
          <ListItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
            label="Personal Information"
          />
          <ListItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            }
            label="Connected Accounts"
            sublabel="KakaoTalk Linked"
          />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Preferences</h2>
        <div className="space-y-2">
          <ListItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            }
            label="Push Notifications"
          />
          <ListItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            }
            label="Language"
            sublabel="English (US)"
          />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Support</h2>
        <div className="space-y-2">
          <ListItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
            label="FAQ"
          />
          <ListItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            }
            label="Contact Us"
          />
          <ListItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
            label="Privacy Policy"
          />
          <ListItem
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            }
            label="Terms of Service"
          />
        </div>
      </section>

      <div className="text-center space-y-2 mb-6">
        <button
          type="button"
          onClick={handleLogout}
          className="text-red-600 font-medium hover:underline"
        >
          Logout
        </button>
        <br />
        <button
          type="button"
          onClick={() => { setDeleteError(null); setShowDeleteConfirm(true) }}
          className="text-gray-500 text-sm hover:underline hover:text-red-600"
        >
          Delete Account
        </button>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">계정 삭제</h3>
            <p className="text-sm text-gray-600 mb-4">
              계정과 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 계속할까요?
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '처리 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-400">App Version 2.4.1 (Stable)</p>
    </div>
  )
}
