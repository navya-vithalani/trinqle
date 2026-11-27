import React from 'react'
import { LIMITS } from '../../core/limits'

interface TextWidgetProps {
  label: string
  value: string | undefined
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
}

export const TextWidget: React.FC<TextWidgetProps> = ({
  label,
  value = '',
  onChange,
  placeholder = 'Optional (works with Gboard voice typing)...',
  disabled,
  maxLength = LIMITS.LONG_TEXT,
}) => {
  const showCounter = value.length >= Math.floor(maxLength * 0.85)

  return (
    <div className="py-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
        {showCounter && (
          <span className="text-[10px] font-semibold text-[var(--color-ink-soft)]">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        rows={3}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs text-[var(--color-ink)] bg-[var(--color-bg)] rounded-[var(--radius-m)] p-3 border-2 border-[var(--color-line)] resize-none focus:outline-none focus:border-[var(--color-accent)] leading-relaxed"
      />
    </div>
  )
}
