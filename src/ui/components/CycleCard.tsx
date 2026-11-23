import React, { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Droplets } from 'lucide-react'
import type { Cycle } from '../../data/types'
import { calculateCycleStats } from '../../core/cycle'
import { addDays } from '../../core/logicalDay'

interface CycleCardProps {
  cycles: Cycle[]
  activeCycle?: Cycle
  todayLogicalDate: string
  onStartCycle: (date: string) => Promise<void>
  onEndCycle: (cycleId: string, date: string) => Promise<void>
}

export const CycleCard: React.FC<CycleCardProps> = ({
  cycles,
  activeCycle,
  todayLogicalDate,
  onStartCycle,
  onEndCycle,
}) => {
  const [viewOffsetMonths, setViewOffsetMonths] = useState(0)
  const stats = calculateCycleStats(cycles)

  // Current calendar view month
  const now = new Date()
  const viewDate = new Date(now.getFullYear(), now.getMonth() + viewOffsetMonths, 1)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth() // 0-indexed

  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const firstDayWeekday = new Date(year, month, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Calculate day N of active cycle
  let dayInCycle = 0
  if (activeCycle) {
    const [cy, cm, cd] = activeCycle.startDate.split('-').map(Number)
    const [ty, tm, td] = todayLogicalDate.split('-').map(Number)
    const startMs = Date.UTC(cy, cm - 1, cd)
    const todayMs = Date.UTC(ty, tm - 1, td)
    dayInCycle = Math.max(1, Math.round((todayMs - startMs) / 86400000) + 1)
  }

  // Set of bleeding dates across cycles
  const bleedDates = new Set<string>()
  cycles.forEach((c) => {
    const end = c.endDate || (c === activeCycle ? todayLogicalDate : c.startDate)
    let cur = c.startDate
    while (cur <= end) {
      bleedDates.add(cur)
      cur = addDays(cur, 1)
    }
  })

  // Calendar cells
  const blanks = Array.from({ length: firstDayWeekday })
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="sticker-card p-4 space-y-3.5">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Droplets size={18} className="text-rose-500 shrink-0" />
          <div>
            <h3 className="font-bold text-sm text-[var(--color-ink)]">Menstrual Cycle</h3>
            <p className="text-[11px] text-[var(--color-ink-soft)]">
              {activeCycle ? `Period active • Day ${dayInCycle}` : 'No active bleeding'}
            </p>
          </div>
        </div>

        {/* Toggle Period Button */}
        {activeCycle ? (
          <button
            type="button"
            onClick={() => onEndCycle(activeCycle.id, todayLogicalDate)}
            className="py-1.5 px-3 rounded-[var(--radius-pill)] bg-rose-100 text-rose-800 border border-rose-300 font-semibold text-xs active:scale-95"
          >
            End Period
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStartCycle(todayLogicalDate)}
            className="py-1.5 px-3 rounded-[var(--radius-pill)] bg-rose-500 text-white font-bold text-xs sticker-button flex items-center space-x-1 active:scale-95"
          >
            <Droplets size={12} />
            <span>Log Start</span>
          </button>
        )}
      </div>

      {/* Cycle Statistics / Prediction */}
      <div className="p-2.5 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] text-xs text-[var(--color-ink-soft)] space-y-1">
        {stats.hasEnoughData ? (
          <div className="flex items-center justify-between text-xs">
            <span>
              Average cycle: <strong>{stats.averageLengthDays} days</strong>
            </span>
            {stats.predictedNextStart && (
              <span className="text-rose-600 font-semibold">
                Next: ~{stats.predictedNextStart}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px]">
            <span>Need 3 cycles for predictions</span>
            <span className="font-semibold text-[var(--color-ink)]">
              {stats.cycleCount} of 3 recorded
            </span>
          </div>
        )}
      </div>

      {/* Mini Calendar Month Navigation */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setViewOffsetMonths((o) => o - 1)}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-90"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold text-[var(--color-ink)] flex items-center space-x-1">
            <Calendar size={13} className="text-[var(--color-accent)] inline mr-1" />
            {monthName}
          </span>
          <button
            type="button"
            onClick={() => setViewOffsetMonths((o) => o + 1)}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-90"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[var(--color-ink-soft)]">
          <span>Su</span>
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span>Sa</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {blanks.map((_, i) => (
            <div key={`blank-${i}`} className="aspect-square" />
          ))}
          {daysArray.map((dayNum) => {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
              dayNum
            ).padStart(2, '0')}`
            const isBleed = bleedDates.has(dateStr)
            const isToday = dateStr === todayLogicalDate

            let style = 'text-[var(--color-ink)] text-xs rounded-full aspect-square flex items-center justify-center'
            if (isBleed) {
              style += ' bg-rose-500 text-white font-bold'
            } else if (isToday) {
              style += ' border-2 border-[var(--color-accent)] font-bold'
            }

            return (
              <div key={dateStr} className={style}>
                {dayNum}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
