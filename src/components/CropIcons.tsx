import { Bean, Cherry, Circle, Cloud, Flower2, Sprout, Wheat } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CropKey } from '../types'

const cropIcons: Record<CropKey, LucideIcon> = {
  wheat: Wheat,
  rice: Sprout,
  cotton: Cloud,
  onion: Circle,
  tomato: Cherry,
  potato: Circle,
  soybean: Bean,
  mustard: Flower2,
}

export function CropIcon({
  cropId,
  size = 26,
  className = '',
  label,
}: {
  cropId: string
  size?: number
  className?: string
  label?: string
}) {
  const Icon = cropIcons[cropId as CropKey] ?? Sprout
  return (
    <span className={`crop-icon ${className}`} aria-hidden="true">
      <Icon size={size} strokeWidth={1.5} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}
