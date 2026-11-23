import React from 'react'
import { Star } from 'lucide-react'
import type { ScaleConfig } from '../../data/types'

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
  const currentVal = value ?? min
  const pct = Math.max(0, Math.min(100, ((currentVal - min) / (max - min)) * 100))

  if (display === 'stars') {
    const starCount = Math.min(Math.round(max - min), 10)
    return (
      <div className="py-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
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

  // Slider display with flowing gradient fill from left to pointer
  return (
    <div className="py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
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
