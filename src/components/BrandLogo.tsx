import { AudioLines } from 'lucide-react'

export function BrandLogo({ size = 42, subtitle = 'Voice Advisory' }: { size?: number; subtitle?: string }) {
  return (
    <div className="brand-logo">
      <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
        <AudioLines size={Math.round(size * 0.52)} strokeWidth={1.5} />
      </span>
      <div>
        <span className="brand-label">Kisan<span className="brand-accent">Vani</span></span>
        <small>{subtitle}</small>
      </div>
    </div>
  )
}
