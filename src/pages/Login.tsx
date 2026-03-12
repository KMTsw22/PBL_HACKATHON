import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const getRedirectUrl = () => {
  const envUrl = import.meta.env.VITE_APP_URL
  if (envUrl) return `${envUrl.replace(/\/$/, '')}/`
  return `${window.location.origin}/`
}

export default function Login() {
  const [error, setError] = useState<string | null>(null)

  // 카카오/Google 로그인 후 리다이렉트돼 왔을 때 URL 해시(#access_token 등)에서 세션 복구
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // 해시 제거 후 깔끔한 URL로 (세션은 이미 저장됨)
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    })
  }, [])

  const handleKakaoLogin = async () => {
    setError(null)
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: getRedirectUrl() },
    })
    if (err) {
      setError(err.message || '카카오 로그인에 실패했어요.')
      return
    }
    if (data?.url) window.location.href = data.url
  }

  const handleGoogleLogin = async () => {
    setError(null)
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getRedirectUrl() },
    })
    if (err) {
      setError(err.message || 'Google 로그인에 실패했어요.')
      return
    }
    if (data?.url) window.location.href = data.url
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Coral top section with wavy pattern */}
      <div className="relative h-[35vh] bg-[#FF9C8F] overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 h-px bg-white"
              style={{ top: `${15 + i * 12}%` }}
            />
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-white rounded-t-[2rem]" />
      </div>

      {/* Main content - white background */}
      <div className="flex-1 -mt-8 px-6 flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center -mt-2 relative">
          <div className="w-12 h-10 bg-gray-700 rounded-lg flex items-center justify-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-6 text-center leading-tight">
          My Networking
          <br />
          Agent
        </h1>
        <p className="text-gray-500 text-sm mt-2 mb-12">스마트한 인맥 관리를 시작해보세요</p>
        {error && (
          <div className="w-full max-w-sm mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
            <p className="mt-2 text-xs text-red-600">
              Supabase 대시보드 → Authentication → Providers에서 카카오가 켜져 있는지, 카카오 개발자 콘솔에 Redirect URI가 <code className="bg-red-100 px-1 rounded">https://&lt;프로젝트&gt;.supabase.co/auth/v1/callback</code> 로 등록되어 있는지 확인해보세요. 로그인 후 앱으로 안 넘어가면 Authentication → URL Configuration에서 <strong>Redirect URLs</strong>에 현재 접속 주소(예: <code className="bg-red-100 px-1 rounded">http://localhost:5173/**</code>)를 추가하세요.
            </p>
          </div>
        )}
        <div className="w-full max-w-sm space-y-3">
          <button
            type="button"
            onClick={handleKakaoLogin}
            className="w-full flex items-center justify-center gap-2 bg-[#FEE500] text-[#191919] font-semibold py-4 rounded-xl hover:bg-[#FEE500]/90 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3c5.8 0 10.5 4.7 10.5 10.5S17.8 24 12 24 1.5 19.3 1.5 13.5 6.2 3 12 3zm0 2C7.3 5 3.5 8.8 3.5 13.5S7.3 22 12 22s8.5-3.8 8.5-8.5S16.7 5 12 5zm-1 3h2v7h-2V8zm0 9h2v2h-2v-2z" />
            </svg>
            카카오로 시작하기
          </button>
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-700 font-semibold py-4 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google로 시작하기
          </button>
        </div>
        <div className="mt-auto py-8 flex items-center gap-2 text-gray-400 text-xs">
          <button type="button" className="hover:text-gray-600">이용약관</button>
          <span>·</span>
          <button type="button" className="hover:text-gray-600">개인정보처리방침</button>
        </div>
      </div>
    </div>
  )
}
