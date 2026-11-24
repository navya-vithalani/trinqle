import React from 'react'
import {
  Star,
  Flame,
  Zap,
  Heart,
  Smile,
  Battery,
  Activity,
  Sparkles,
  Sun,
  Award,
} from 'lucide-react'
import type { ScaleConfig } from '../../data/types'

const SCALE_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  Star,
  Flame,
  Zap,
  Heart,
  Smile,
  Battery,
  Activity,
  Sparkles,
  Sun,
  Award,
}

interface ScaleWidgetProps {
  label: string
  value: number | undefined
  config?: ScaleConfig
  onChange: (val: number) => void
  disabled?: boolean
  required?: boolean
}

export const ScaleWidget: React.FC<ScaleWidgetProps> = ({
  label,
  value,
  config,
  onChange,
  disabled,
}) => {
  const min = config?.min ?? 0
  const max = config?.max ?? 10
  const step = config?.step ?? 0.5
  const display = config?.display ?? 'slider'
  const iconName = config?.icon || 'Sparkles'
  const IconComponent = SCALE_ICONS[iconName] || Sparkles

  const currentVal = value ?? min
  const pct = Math.max(0, Math.min(100, ((currentVal - min) / (max - min)) * 100))

  // Dynamic icon size scaling linearly from 14px at 0% to 32px at 100%
  const dynamicIconSize = Math.round(14 + (pct / 100) * 18)

  if (display === 'stars') {
    const starCount = Math.min(Math.round(max - min), 10)
    return (
      <div className="py-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
            <div className="w-8 h-8 flex items-center justify-center">
              <IconComponent
                size={dynamicIconSize}
                className="text-[var(--color-accent)] transition-all duration-150"
              />
            </div>
          </div>
          <span className="text-xs font-bold text-[var(--color-accent)]">
            {value !== undefined ? `${value} / ${max}` : 'Not rated'}
          </span>
        </div>
        <div className="flex items-center space-x-1 pt-1">
          {Array.from({ length: starCount }).map((_, idx) => {
            const starVal = min + idx + 1
            const isFilled = value !== undefined && value >= starVal
            return (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => onChange(starVal)}
                className="p-1 transition-transform active:scale-125 focus:outline-none"
                aria-label={`Rate ${starVal} of ${max}`}
              >
                <Star
                  size={26}
                  className={
                    isFilled
                      ? 'fill-[var(--color-star)] text-[var(--color-star)] drop-shadow-sm'
                      : 'text-[var(--color-line)]'
                  }
                />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Slider display with flowing gradient fill from left to pointer & scaling icon
  return (
    <div className="py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
          <div className="w-8 h-8 flex items-center justify-center">
            <IconComponent
              size={dynamicIconSize}
              className="text-[var(--color-accent)] transition-all duration-150 drop-shadow-xs"
            />
          </div>
        </div>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-accent)]">
          {value !== undefined ? value.toFixed(1) : `${min.toFixed(1)}`}
        </span>
      </div>
      <div className="flex items-center space-x-3 pt-1">
        <span className="text-xs font-bold text-[var(--color-ink-soft)]">{min}</span>
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={currentVal}
            disabled={disabled}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            style={{
              background: `linear-gradient(to right, var(--color-accent2) 0%, var(--color-accent) ${pct}%, var(--color-line) ${pct}%, var(--color-line) 100%)`,
            }}
            className="w-full h-3 rounded-full appearance-none cursor-pointer accent-[var(--color-accent)] border border-[var(--color-line)]"
          />
        </div>
        <span className="text-xs font-bold text-[var(--color-ink-soft)]">{max}</span>
      </div>
    </div>
  )
}
