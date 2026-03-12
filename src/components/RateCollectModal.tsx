import { useState, useEffect, useCallback } from 'react'
import type { UserCard } from '@/hooks/useUserCards'
import { analyzeCardForRating } from '@/lib/analyzeCardRating'
import { CardImage } from './CardImage'

const FALLBACK_CATEGORIES = ['Expertise', 'Professionalism', 'Communication'] as const

export type RatingScore = {
  category: string
  score: number
  isAiSuggested: boolean
}

export type RateCollectData = {
  privateNotes: string
  scores: RatingScore[]
}

type Props = {
  isOpen: boolean
  onClose: () => void
  card: UserCard
  initialData?: { scores: { category: string; score: number }[]; privateNotes: string }
  onSubmit: (data: RateCollectData) => Promise<void>
}

function SliderScore({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <span className="text-sm font-bold text-[#FF9C8F]">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={5}
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-[#FFE4E0] rounded-full appearance-none cursor-pointer accent-[#FF9C8F]"
      />
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>DEVELOPING</span>
        <span>EXPERT</span>
      </div>
    </div>
  )
}

export default function RateCollectModal({ isOpen, onClose, card, initialData, onSubmit }: Props) {
  const [scores, setScores] = useState<Record<string, number>>({})
  const [aiCategories, setAiCategories] = useState<string[]>([])
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [privateNotes, setPrivateNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [aiReasons, setAiReasons] = useState<Record<string, string>>({})

  const fetchAiSuggestions = useCallback(async () => {
    if (!isOpen || !card) return
    setAiAnalyzing(true)
    try {
      const suggestions = await analyzeCardForRating({
        card_name: card.card_name,
        description: card.description,
        custom_title: card.custom_title,
        custom_content: card.custom_content,
      })
      if (suggestions.length > 0) {
        const newScores: Record<string, number> = {}
        const categories: string[] = []
        const reasons: Record<string, string> = {}
        for (const s of suggestions) {
          newScores[s.category] = s.score
          categories.push(s.category)
          if (s.reason) reasons[s.category] = s.reason
        }
        setScores(newScores)
        setAiCategories(categories)
        setAiReasons(reasons)
      } else {
        throw new Error('No suggestions')
      }
    } catch {
      const fallback: Record<string, number> = {}
      for (const c of FALLBACK_CATEGORIES) fallback[c] = 4
      setScores(fallback)
      setAiCategories([...FALLBACK_CATEGORIES])
      setAiReasons({})
    } finally {
      setAiAnalyzing(false)
    }
  }, [isOpen, card?.id])

  useEffect(() => {
    if (isOpen && card) {
      if (initialData) {
        const newScores: Record<string, number> = {}
        const categories: string[] = []
        for (const s of initialData.scores) {
          newScores[s.category] = s.score
          categories.push(s.category)
        }
        setScores(newScores)
        setAiCategories(categories)
        setCustomCategories([])
        setPrivateNotes(initialData.privateNotes ?? '')
        setAiAnalyzing(false)
      } else {
        setCustomCategories([])
        fetchAiSuggestions()
      }
    }
  }, [isOpen, card?.id, initialData, fetchAiSuggestions])

  const handleScoreChange = (category: string, value: number) => {
    setScores((prev) => ({ ...prev, [category]: value }))
  }

  const handleAddCategory = () => {
    const trimmed = newCategory.trim()
    const exists = [...aiCategories, ...customCategories].includes(trimmed)
    if (trimmed && !exists) {
      setCustomCategories((prev) => [...prev, trimmed])
      setScores((prev) => ({ ...prev, [trimmed]: 4 }))
      setNewCategory('')
    }
  }

  const handleRemoveCustom = (cat: string) => {
    setCustomCategories((prev) => prev.filter((c) => c !== cat))
    setScores((prev) => {
      const next = { ...prev }
      delete next[cat]
      return next
    })
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const ratingScores: RatingScore[] = Object.entries(scores).map(([category, score]) => ({
        category,
        score,
        isAiSuggested: aiCategories.includes(category),
      }))
      await onSubmit({
        privateNotes: privateNotes.trim(),
        scores: ratingScores,
      })
      onClose()
    } catch (e) {
      console.error('Rate & Collect 실패:', e)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setScores({})
    setAiCategories([])
    setCustomCategories([])
    setNewCategory('')
    setPrivateNotes('')
    setAiReasons({})
    setAiAnalyzing(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  if (!isOpen) return null

  const allCategories = [...aiCategories, ...customCategories]
  const hasScores = Object.keys(scores).length > 0
  const isEditMode = !!initialData

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} aria-hidden />
      <div className="relative w-full max-w-md flex flex-col bg-white rounded-2xl overflow-hidden shadow-xl max-h-[calc(100dvh-5rem)] sm:max-h-[90vh]">
        <div className="flex-shrink-0 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Rate & Collect</h2>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain">
          {/* Card preview */}
          <div className="flex gap-3 p-3 bg-[#FFE4E0]/50 rounded-xl">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#FFE4E0] flex-shrink-0">
              <CardImage imageUrl={card.image_url} name={card.card_name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{card.card_name || 'My Card'}</p>
              <p className="text-sm text-[#FF9C8F] truncate">{card.custom_title || 'Professional'}</p>
            </div>
          </div>

          {/* Private tip */}
          <div className="p-3 bg-[#FFE4E0]/30 rounded-xl">
            <p className="text-[10px] text-[#FF9C8F] font-semibold uppercase mb-1">Private Tip</p>
            <div className="flex gap-2">
              <span className="text-lg">🤖</span>
              <p className="text-sm text-gray-700">
                AI가 먼저 분석한 점수를 확인하고, 필요하면 수정해주세요! 나중에 Ask에서 특정 인재를 찾을 때 활용돼요.
              </p>
            </div>
          </div>

          {/* AI Analyzing (새 수집 시에만) */}
          {!isEditMode && aiAnalyzing && (
            <div className="flex items-center gap-3 p-4 bg-[#FFE4E0]/30 rounded-xl">
              <div className="w-6 h-6 border-2 border-[#FF9C8F] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-700">AI가 카드를 분석하고 주제별 점수를 제안하고 있어요...</p>
            </div>
          )}

          {/* Detailed Rating */}
          <div className={!isEditMode && aiAnalyzing ? 'opacity-50 pointer-events-none' : ''}>
            <p className="text-xs text-[#FF9C8F] font-semibold uppercase mb-3">
              {isEditMode ? '내가 매긴 점수 (수정 가능)' : '✨ AI가 제안한 점수 (수정 가능)'}
            </p>
            <div className="space-y-4">
              {hasScores && allCategories.map((cat) => (
                <div key={cat} className="p-3 bg-gray-50 rounded-xl">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{cat}</span>
                      {aiReasons[cat] && (
                        <p className="text-xs text-gray-500 mt-0.5">{aiReasons[cat]}</p>
                      )}
                    </div>
                    {customCategories.includes(cat) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustom(cat)}
                        className="text-xs text-red-500 hover:underline flex-shrink-0"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <SliderScore
                    value={scores[cat] ?? 4}
                    onChange={(v) => handleScoreChange(cat, v)}
                  />
                </div>
              ))}
            </div>

            {/* Add custom category */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="커스텀 주제 추가 (예: 해커톤 적합도)"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-4 py-2 bg-[#FF9C8F] text-white text-sm font-medium rounded-lg hover:bg-[#FF8A7A]"
              >
                + 추가
              </button>
            </div>
          </div>

          {/* Private Notes */}
          <div>
            <p className="text-xs text-[#FF9C8F] font-semibold uppercase mb-2">Private Notes</p>
            <textarea
              placeholder="예: 디테일 감각이 뛰어남, 리브랜딩 프로젝트에 적합할 것 같아요..."
              value={privateNotes}
              onChange={(e) => setPrivateNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 resize-none"
            />
          </div>
        </div>

        <div className="flex-shrink-0 p-4 pt-0 border-t border-gray-100 bg-white pb-8">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || (!isEditMode && aiAnalyzing) || !hasScores}
            className="w-full py-3 bg-[#FF9C8F] text-white font-medium rounded-xl hover:bg-[#FF8A7A] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? '저장 중...' : !isEditMode && aiAnalyzing ? 'AI 분석 중...' : isEditMode ? '수정 저장' : 'Submit Review & Collect'}
          </button>
        </div>
      </div>
    </div>
  )
}
