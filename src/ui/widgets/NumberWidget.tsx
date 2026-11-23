import React from 'react'
import { Minus, Plus } from 'lucide-react'
import type { NumberConfig } from '../../data/types'

interface NumberWidgetProps {
  label: string
  value: number | undefined
  config?: NumberConfig
  onChange: (val: number) => void
  disabled?: boolean
}

export const NumberWidget: React.FC<NumberWidgetProps> = ({
  label,
  value,
  config,
  onChange,
  disabled,
}) => {
  const min = config?.min ?? 0
  const max = config?.max ?? 99999
  const step = config?.step ?? 1
  const unit = config?.unit || ''
  const currentVal = value ?? min

  const handleStep = (delta: number) => {
    const next = Math.min(max, Math.max(min, currentVal + delta))
    onChange(next)
  }

  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
        {unit && <span className="text-xs text-[var(--color-ink-soft)] ml-1">({unit})</span>}
      </div>
      <div className="flex items-center space-x-2">
        <button
          type="button"
          disabled={disabled || currentVal <= min}
          onClick={() => handleStep(-step)}
          className="w-8 h-8 rounded-full border-2 border-[var(--color-line)] bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-ink)] active:scale-95 disabled:opacity-40"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          placeholder="0"
          disabled={disabled}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value)
            onChange(isNaN(parsed) ? 0 : parsed)
          }}
          className="w-16 text-center text-sm font-bold bg-[var(--color-bg)] rounded-[var(--radius-m)] py-1 border-2 border-[var(--color-line)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="button"
          disabled={disabled || currentVal >= max}
          onClick={() => handleStep(step)}
          className="w-8 h-8 rounded-full border-2 border-[var(--color-line)] bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-ink)] active:scale-95 disabled:opacity-40"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
