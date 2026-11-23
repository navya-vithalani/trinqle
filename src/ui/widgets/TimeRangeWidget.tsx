import React, { useState } from 'react'
import { Clock } from 'lucide-react'
import type { TimeRangeValue } from '../../data/types'
import { calculateMinutes } from '../../core/logicalDay'

interface TimeRangeWidgetProps {
  label: string
  value: TimeRangeValue | undefined
  onChange: (val: TimeRangeValue) => void
  disabled?: boolean
}

function formatMinutesToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export const TimeRangeWidget: React.FC<TimeRangeWidgetProps> = ({
  label,
  value,
  onChange,
  disabled,
}) => {
  const [start, setStart] = useState(value?.start || '22:00')
  const [end, setEnd] = useState(value?.end || '06:30')
  const [crossesMidnight, setCrossesMidnight] = useState(value?.crossesMidnight ?? true)

  const durationMin = calculateMinutes(start, end, crossesMidnight)

  const handleUpdate = (newStart: string, newEnd: string, newCross: boolean) => {
    setStart(newStart)
    setEnd(newEnd)
    setCrossesMidnight(newCross)
    onChange({
      start: newStart,
      end: newEnd,
      crossesMidnight: newCross,
    })
  }

  return (
    <div className="py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Clock size={16} className="text-[var(--color-accent)]" />
          <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
        </div>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--color-bg)] text-[var(--color-accent)] border border-[var(--color-line)]">
          {formatMinutesToHours(durationMin)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-[var(--color-bg)] p-2.5 rounded-[var(--radius-m)] border-2 border-[var(--color-line)]">
        <div>
          <label className="text-[11px] text-[var(--color-ink-soft)] block mb-1">Start time</label>
          <input
            type="time"
            value={start}
            disabled={disabled}
            onChange={(e) => handleUpdate(e.target.value, end, crossesMidnight)}
            className="w-full text-xs font-semibold p-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[11px] text-[var(--color-ink-soft)] block mb-1">End time</label>
          <input
            type="time"
            value={end}
            disabled={disabled}
            onChange={(e) => handleUpdate(start, e.target.value, crossesMidnight)}
            className="w-full text-xs font-semibold p-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-0.5 px-1">
        <label className="flex items-center space-x-1.5 cursor-pointer text-[var(--color-ink-soft)]">
          <input
            type="checkbox"
            checked={crossesMidnight}
            disabled={disabled}
            onChange={(e) => handleUpdate(start, end, e.target.checked)}
            className="accent-[var(--color-accent)] rounded"
          />
          <span>Crosses midnight</span>
        </label>
      </div>
    </div>
  )
}
