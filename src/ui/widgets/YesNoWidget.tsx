import React from 'react'

interface YesNoWidgetProps {
  label: string
  value: boolean | undefined
  onChange: (val: boolean) => void
  disabled?: boolean
}

export const YesNoWidget: React.FC<YesNoWidgetProps> = ({
  label,
  value = false,
  onChange,
  disabled,
}) => {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
      <div className="flex items-center bg-[var(--color-bg)] rounded-[var(--radius-pill)] p-1 border-2 border-[var(--color-line)]">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(false)}
          className={`px-3 py-1 text-xs font-semibold rounded-[var(--radius-pill)] transition-all ${
            !value
              ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm'
              : 'text-[var(--color-ink-soft)]'
          }`}
        >
          No
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(true)}
          className={`px-3 py-1 text-xs font-semibold rounded-[var(--radius-pill)] transition-all ${
            value
              ? 'bg-[var(--color-accent)] text-white shadow-sm'
              : 'text-[var(--color-ink-soft)]'
          }`}
        >
          Yes
        </button>
      </div>
    </div>
  )
}
