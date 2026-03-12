import { useState } from 'react'

type CardImageProps = {
  imageUrl: string
  name?: string | null
  className?: string
  alt?: string
}

const isPlaceholdCo = (url: string) => typeof url === 'string' && url.includes('placehold.co')

/** 카드 이미지. placehold.co는 403 막힘으로 요청하지 않고, 그 외 실패 시 이름 첫 글자로 폴백 */
export function CardImage({ imageUrl, name, className = '', alt = '' }: CardImageProps) {
  const [failed, setFailed] = useState(false)
  const initial = (name || '?').charAt(0).toUpperCase()
  const hue = name ? (name.charCodeAt(0) * 17 + (name.length || 1) * 31) % 360 : 200
  const useFallback = failed || !imageUrl || isPlaceholdCo(imageUrl)

  if (useFallback) {
    return (
      <div
        className={`flex items-center justify-center text-white font-bold bg-opacity-90 ${className}`}
        style={{ backgroundColor: `hsl(${hue}, 45%, 40%)` }}
        aria-hidden
      >
        {initial}
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
