import { useState, useEffect } from 'react'
import { CardImage } from '@/components/CardImage'
import { generateCardImage } from '@/lib/openai'
import type { Profile } from '@/hooks/useProfile'
import type { UserCard } from '@/hooks/useUserCards'

export type AddCardData = {
  cardId?: string
  cardName: string | null
  card_description: string | null
  customTitle: string | null
  customContent: string | null
  aiGeneratedImageUrl: string
  portfolio_url: string | null
  email: string | null
  kakao_id: string | null
  phone: string | null
}

type CustomField = { title: string; content: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  profile: Profile | null
  userId: string | undefined
  initialCard?: UserCard | null
  onSave: (data: AddCardData) => Promise<void>
}

export default function AddCardModal({ isOpen, onClose, profile: _profile, userId, initialCard, onSave }: Props) {
  const [cardName, setCardName] = useState('')
  const [cardDescription, setCardDescription] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [email, setEmail] = useState('')
  const [kakaoId, setKakaoId] = useState('')
  const [phone, setPhone] = useState('')
  const [customFields, setCustomFields] = useState<CustomField[]>([{ title: '', content: '' }])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [, setPhotoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPhase, setLoadingPhase] = useState<'generate' | 'save'>('generate')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setCardName('')
    setCardDescription('')
    setPortfolioUrl('')
    setEmail('')
    setKakaoId('')
    setPhone('')
    setCustomFields([{ title: '', content: '' }])
    setImageUrl(null)
    setPhotoFile(null)
    setError(null)
    setLoadingPhase('generate')
  }

  useEffect(() => {
    if (isOpen && initialCard) {
      setCardName(initialCard.card_name || '')
      setCardDescription(initialCard.description || '')
      setPortfolioUrl(initialCard.portfolio_url || '')
      setEmail(initialCard.email || '')
      setKakaoId(initialCard.kakao_id || '')
      setPhone(initialCard.phone || '')
      setCustomFields(
        initialCard.custom_title || initialCard.custom_content
          ? [{ title: initialCard.custom_title || '', content: initialCard.custom_content || '' }]
          : [{ title: '', content: '' }]
      )
      setImageUrl(initialCard.image_url)
    } else if (isOpen && !initialCard) {
      reset()
    }
  }, [isOpen, initialCard])

  const handleClose = () => {
    reset()
    onClose()
  }

  const addCustomField = () => {
    setCustomFields((prev) => [...prev, { title: '', content: '' }])
  }

  const updateCustomField = (i: number, key: keyof CustomField, value: string) => {
    setCustomFields((prev) => {
      const next = [...prev]
      next[i] = { ...next[i], [key]: value }
      return next
    })
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      setImageUrl(URL.createObjectURL(file))
    }
  }

  const handleSave = async () => {
    const description = cardDescription?.trim()
    if (!description) {
      setError('카드 설명을 입력해주세요.')
      return
    }

    setError(null)
    setLoading(true)
    setLoadingPhase('generate')
    let finalImageUrl: string
    const first = customFields[0]
    try {
      finalImageUrl = await generateCardImage({
        cardName: cardName?.trim() || undefined,
        description,
        customTitle: first?.title?.trim() || undefined,
        customContent: first?.content?.trim() || undefined,
        userId: userId,
      })
      if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl)
      setImageUrl(finalImageUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 이미지 생성에 실패했습니다.')
      setLoading(false)
      return
    }
    setLoadingPhase('save')
    try {
      const first = customFields[0]
      await onSave({
        cardId: initialCard?.id,
        cardName: cardName.trim() || null,
        card_description: cardDescription.trim() || null,
        customTitle: first?.title?.trim() || null,
        customContent: first?.content?.trim() || null,
        aiGeneratedImageUrl: finalImageUrl,
        portfolio_url: portfolioUrl.trim() || null,
        email: email.trim() || null,
        kakao_id: kakaoId.trim() || null,
        phone: phone.trim() || null,
      })
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden />
      <div className="relative w-full max-w-md flex flex-col bg-white rounded-t-2xl sm:rounded-2xl max-h-[calc(100dvh-5rem)] sm:max-h-[90vh]">
        <div className="flex-shrink-0 bg-white pt-2 pb-3 px-4">
          <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#FF9C8F] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm">🤖</span>
            </div>
            <div className="flex-1 bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <p className="text-sm text-gray-700">What else should we know about this card?</p>
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900">{initialCard ? 'Edit Card' : 'Add New Card'}</h2>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Card Name</label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g., Side Project, Career"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF9C8F] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Description (필수)</label>
            <textarea
              value={cardDescription}
              onChange={(e) => setCardDescription(e.target.value)}
              placeholder="카드에 대한 설명을 입력하세요. AI 이미지 생성에 사용됩니다."
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF9C8F] focus:border-transparent"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={addCustomField}
              className="flex items-center gap-2 text-[#FF9C8F] font-medium text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Custom Field
            </button>
            <div className="mt-2 space-y-3">
              {customFields.map((field, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Title</label>
                    <input
                      type="text"
                      value={field.title}
                      onChange={(e) => updateCustomField(i, 'title', e.target.value)}
                      placeholder="e.g., Hobby"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Content</label>
                    <input
                      type="text"
                      value={field.content}
                      onChange={(e) => updateCustomField(i, 'content', e.target.value)}
                      placeholder="e.g., Surfing"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Links & Portfolio</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                </svg>
              </span>
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="Portfolio or personal website"
                className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF9C8F] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Contact Info</label>
            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF9C8F] focus:border-transparent"
                />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={kakaoId}
                  onChange={(e) => setKakaoId(e.target.value)}
                  placeholder="Kakao ID"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF9C8F] focus:border-transparent"
                />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF9C8F] focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Card Photo</label>
            <p className="text-xs text-gray-500 mb-2">
              {initialCard ? '저장 시 수정된 내용으로 AI가 이미지를 다시 생성합니다.' : 'Add Card 시 AI가 카드 이미지를 생성합니다.'}
            </p>
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#FF9C8F] hover:bg-[#FFE4E0]/20 transition-colors">
              {imageUrl ? (
                <div className="relative w-full h-full rounded-xl overflow-hidden">
                  <CardImage imageUrl={imageUrl} name={cardName} className="w-full h-full object-cover" />
                </div>
              ) : (
                <>
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm text-gray-500">Upload Photo (참조용)</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex-shrink-0 p-4 pt-2 border-t border-gray-100 bg-white pb-8">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="w-full py-4 bg-[#FF9C8F] text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">
                {loadingPhase === 'generate' ? 'AI 이미지 생성 중...' : '카드 저장 중...'}
              </span>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {initialCard ? '저장' : 'Add Card'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
