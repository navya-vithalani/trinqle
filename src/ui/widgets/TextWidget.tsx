import React from 'react'

interface TextWidgetProps {
  label: string
  value: string | undefined
  onChange: (val: string) => void
  placeholder?: string
  disabled?: boolean
}

export const TextWidget: React.FC<TextWidgetProps> = ({
  label,
  value = '',
  onChange,
  placeholder = 'Optional (works with Gboard voice typing)...',
  disabled,
}) => {
  return (
    <div className="py-2.5 space-y-1.5">
      <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
      <textarea
        rows={3}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs text-[var(--color-ink)] bg-[var(--color-bg)] rounded-[var(--radius-m)] p-3 border-2 border-[var(--color-line)] resize-none focus:outline-none focus:border-[var(--color-accent)] leading-relaxed"
      />
    </div>
  )
}
