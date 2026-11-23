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

/**
 * Converts HH:mm into minutes from 03:00 (logical day start).
 * Logical day: 03:00 (0 min) -> 24:00 (1260 min) -> 03:00 next day (1440 min).
 */
function timeToLogicalMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const totalMin = h * 60 + m
  if (totalMin >= 180) {
    return totalMin - 180
  } else {
    // 00:00 to 02:59 is past midnight
    return totalMin + 24 * 60 - 180
  }
}

/**
 * Converts minutes from 03:00 back to HH:mm.
 */
export function logicalMinutesToTime(minFrom3am: number): string {
  const absoluteMin = (minFrom3am + 180) % (24 * 60)
  const h = Math.floor(absoluteMin / 60)
  const m = absoluteMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const TimeRangeWidget: React.FC<TimeRangeWidgetProps> = ({
  label,
  value,
  onChange,
  disabled,
}) => {
  const [start, setStart] = useState(value?.start || '23:00')
  const [end, setEnd] = useState(value?.end || '07:00')

  // Auto-calculate crossesMidnight:
  // If end < start or logical minutes span across 00:00 (which is 1260 min from 03:00)
  const startLogMin = timeToLogicalMinutes(start)
  const endLogMin = timeToLogicalMinutes(end)
  const crossesMidnight = end < start || (start >= '21:00' && end <= '12:00')

  const durationMin = calculateMinutes(start, end, crossesMidnight)

  const handleUpdate = (newStart: string, newEnd: string) => {
    setStart(newStart)
    setEnd(newEnd)
    const isCross = newEnd < newStart || (newStart >= '21:00' && newEnd <= '12:00')
    onChange({
      start: newStart,
      end: newEnd,
      crossesMidnight: isCross,
    })
  }

  // Visual vertical track height = 180px
  const TRACK_HEIGHT = 180
  const topPct = Math.min(100, Math.max(0, (startLogMin / 1440) * 100))
  let heightPct = 0
  if (endLogMin >= startLogMin) {
    heightPct = ((endLogMin - startLogMin) / 1440) * 100
  } else {
    heightPct = ((1440 - startLogMin + endLogMin) / 1440) * 100
  }
  heightPct = Math.min(100 - topPct, Math.max(5, heightPct))

  return (
    <div className="py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Clock size={16} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
        </div>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--color-bg)] text-[var(--color-accent)] border border-[var(--color-line)]">
          {formatMinutesToHours(durationMin)}
        </span>
      </div>

      {/* Side-by-side: 24h Vertical Timeline on left, inputs & presets on right */}
      <div className="flex items-center space-x-4 bg-[var(--color-bg)]/60 p-3 rounded-[var(--radius-m)] border-2 border-[var(--color-line)]">
        {/* 24-hour vertical timeline track (3am -> 3am) */}
        <div className="flex flex-col items-center space-y-1">
          <span className="text-[9px] font-bold text-[var(--color-ink-soft)]">3 am</span>
          <div
            style={{ height: `${TRACK_HEIGHT}px` }}
            className="w-5 bg-[var(--color-line)] rounded-full relative overflow-hidden border border-[var(--color-line)] shadow-inner"
          >
            {/* Midnight tick marker (21 hours from 3am = 87.5% down) */}
            <div
              style={{ top: '87.5%' }}
              className="absolute left-0 right-0 h-0.5 bg-purple-400 z-10"
              title="Midnight"
            />
            {/* Highlighted active timeframe block */}
            <div
              style={{
                top: `${topPct}%`,
                height: `${heightPct}%`,
              }}
              className="absolute left-0 right-0 bg-gradient-to-b from-[var(--color-accent2)] to-[var(--color-accent)] rounded-sm opacity-90 transition-all shadow-sm"
            />
          </div>
          <span className="text-[9px] font-bold text-[var(--color-ink-soft)]">3 am</span>
        </div>

        {/* Right side: Time selectors and inputs */}
        <div className="flex-1 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-[var(--color-ink-soft)] block mb-1">
                Start time
              </label>
              <input
                type="time"
                value={start}
                step={900} // 15 min snapping
                disabled={disabled}
                onChange={(e) => handleUpdate(e.target.value, end)}
                className="w-full text-xs font-bold p-1.5 rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--color-ink-soft)] block mb-1">
                End time
              </label>
              <input
                type="time"
                value={end}
                step={900} // 15 min snapping
                disabled={disabled}
                onChange={(e) => handleUpdate(start, e.target.value)}
                className="w-full text-xs font-bold p-1.5 rounded-lg border-2 border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { label: 'Night sleep', s: '23:00', e: '07:00' },
              { label: 'Nap', s: '14:00', e: '15:00' },
              { label: 'Morning', s: '09:00', e: '12:00' },
              { label: 'Evening', s: '18:00', e: '20:30' },
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => handleUpdate(p.s, p.e)}
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] active:scale-95"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
