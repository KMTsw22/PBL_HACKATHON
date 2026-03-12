type AvatarProps = {
  photoUrl?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-xl',
}

export function Avatar({ photoUrl, name, size = 'md', className = '' }: AvatarProps) {
  const initial = (name || '?').charAt(0).toUpperCase()
  const sizeClass = sizeClasses[size]

  return (
    <div
      className={`rounded-full overflow-hidden bg-[#FFE4E0] flex items-center justify-center text-[#FF9C8F] font-bold flex-shrink-0 ${sizeClass} ${className}`}
      aria-hidden
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  )
}
