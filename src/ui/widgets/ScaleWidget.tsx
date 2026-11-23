import React from 'react'
import { Star } from 'lucide-react'
import type { ScaleConfig } from '../../data/types'

interface ScaleWidgetProps {
  label: string
  value: number | undefined
  config?: ScaleConfig
  onChange: (val: number) => void
  disabled?: boolean
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

  if (display === 'stars') {
    const starCount = Math.min(Math.round(max - min), 10)
    return (
      <div className="py-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
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

  // Slider display
  return (
    <div className="py-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-accent)]">
          {value !== undefined ? value.toFixed(1) : `${min.toFixed(1)}`}
        </span>
      </div>
      <div className="flex items-center space-x-3 pt-1">
        <span className="text-xs font-medium text-[var(--color-ink-soft)]">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentVal}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 accent-[var(--color-accent)] h-2 bg-[var(--color-bg)] rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-xs font-medium text-[var(--color-ink-soft)]">{max}</span>
      </div>
    </div>
  )
}
