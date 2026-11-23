import React from 'react'
import { Check, X } from 'lucide-react'

interface YesNoWidgetProps {
  label: string
  value: boolean | undefined
  onChange: (val: boolean | undefined) => void
  disabled?: boolean
  required?: boolean
  variant?: 'checkbox' | 'toggle'
}

export const YesNoWidget: React.FC<YesNoWidgetProps> = ({
  label,
  value,
  onChange,
  disabled,
  required,
}) => {
  // Tri-state cycle: undefined (blank) -> true (checked) -> false (declined) -> true
  const handleClick = () => {
    if (disabled) return
    if (value === undefined) {
      onChange(true) // First tap = Yes
    } else if (value === true) {
      onChange(false) // Second tap = No
    } else {
      onChange(true) // Tap again = Yes
    }
  }

  const isUnanswered = value === undefined

  return (
    <div
      onClick={handleClick}
      className={`flex items-center justify-between py-2.5 px-3 rounded-[var(--radius-m)] cursor-pointer select-none transition-colors border-2 ${
        isUnanswered && required
          ? 'border-amber-300 bg-amber-50/40'
          : 'border-[var(--color-line)] bg-[var(--color-bg)]/40 hover:bg-[var(--color-bg)]'
      }`}
    >
      <div className="flex items-center space-x-2">
        <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
        {required && isUnanswered && (
          <span className="text-[10px] text-amber-600 font-bold bg-amber-100 px-1.5 py-0.5 rounded">
            Required
          </span>
        )}
      </div>

      <div className="flex items-center space-x-2">
        {/* State label badge */}
        <span className="text-xs font-bold text-[var(--color-ink-soft)]">
          {value === true ? (
            <span className="text-[var(--color-accent)] font-bold">Yes</span>
          ) : value === false ? (
            <span className="text-[var(--color-ink-soft)]">No</span>
          ) : (
            <span className="text-amber-600 font-medium italic text-[11px]">Tap to check</span>
          )}
        </span>

        {/* Chunky themeable checkbox box */}
        <div
          className={`w-7 h-7 rounded-[var(--radius-s)] border-2 flex items-center justify-center transition-all ${
            value === true
              ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-xs scale-105'
              : value === false
                ? 'bg-[var(--color-line)] border-[var(--color-ink-soft)] text-[var(--color-ink-soft)]'
                : 'bg-[var(--color-surface)] border-[var(--color-line)]'
          }`}
        >
          {value === true && <Check size={18} strokeWidth={3} />}
          {value === false && <X size={16} strokeWidth={2.5} />}
        </div>
      </div>
    </div>
  )
}
