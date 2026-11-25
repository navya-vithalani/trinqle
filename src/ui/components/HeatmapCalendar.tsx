import React from 'react'
import { addDays } from '../../core/logicalDay'
import { calculateChapterDuration } from '../../core/chapters'
import type { Chapter, Day } from '../../data/types'
import { Star, Triangle } from 'lucide-react'

interface HeatmapCalendarProps {
  chapter: Chapter
  days: Day[]
  todayLogicalDate: string
  weekStart?: 'Monday' | 'Sunday'
  onSelectDate: (date: string) => void
}

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({
  chapter,
  days,
  todayLogicalDate,
  weekStart = 'Monday',
  onSelectDate,
}) => {
  const totalDays = calculateChapterDuration(chapter.startDate, chapter.plannedEndDate)
  const daysMap = new Map<string, Day>()
  days.forEach((d) => daysMap.set(d.date, d))

  const [sy, sm, sd] = chapter.startDate.split('-').map(Number)
  const startWeekday = new Date(sy, sm - 1, sd).getDay() // 0=Sun..6=Sat
  const leadingBlanks =
    weekStart === 'Monday' ? (startWeekday + 6) % 7 : startWeekday
  const weekdayHeaders =
    weekStart === 'Monday'
      ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
      : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  const cells: {
    date: string
    dayNumber: number
    day: Day | undefined
    isToday: boolean
    isFuture: boolean
  }[] = []

  for (let i = 0; i < totalDays; i++) {
    const dStr = addDays(chapter.startDate, i)
    const isToday = dStr === todayLogicalDate
    const isFuture = dStr > todayLogicalDate
    cells.push({
      date: dStr,
      dayNumber: i + 1,
      day: daysMap.get(dStr),
      isToday,
      isFuture,
    })
  }

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--color-ink-soft)] px-1">
        <div className="flex items-center space-x-2">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-[var(--color-accent)] inline-block" />
            <span>Full</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-[var(--color-accent)]/30 border border-[var(--color-accent)]/50 inline-block" />
            <span>Quick</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
            <span>Backfill</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] inline-block" />
            <span>Empty</span>
          </span>
        </div>

        <div className="flex items-center space-x-2.5">
          <span className="flex items-center space-x-1">
            <Star size={10} className="fill-amber-400 text-amber-500" />
            <span>Starred</span>
          </span>
          <span className="flex items-center space-x-1">
            <Triangle size={9} className="fill-indigo-400 text-indigo-500" />
            <span>Outstanding</span>
          </span>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-[10px] font-bold text-[var(--color-ink-soft)]">
        {weekdayHeaders.map((wd) => (
          <div key={wd} className="py-0.5">
            {wd}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}
        {cells.map(({ date, dayNumber, day, isToday, isFuture }) => {
          let bgClass =
            'bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-[var(--color-ink)]'

          if (isFuture) {
            bgClass =
              'bg-[var(--color-bg)]/40 border border-dashed border-[var(--color-line)] text-[var(--color-ink-soft)] opacity-40'
          } else if (day) {
            if (day.backfilled) {
              // Dedicated distinct Backfill color (Item 26)
              bgClass =
                'bg-amber-500 border-2 border-amber-600 text-white font-bold shadow-xs'
            } else if (day.mode === 'full') {
              bgClass =
                'bg-[var(--color-accent)] border-2 border-[var(--color-accent)] text-white font-bold shadow-xs'
            } else {
              bgClass =
                'bg-[var(--color-accent)]/25 border-2 border-[var(--color-accent)]/50 text-[var(--color-ink)] font-semibold'
            }
          }

          const ringClass = isToday ? 'ring-2 ring-[var(--color-ink)] ring-offset-1' : ''

          return (
            <button
              key={date}
              type="button"
              disabled={isFuture}
              onClick={() => onSelectDate(date)}
              className={`aspect-square rounded-[var(--radius-s)] flex flex-col items-center justify-center relative text-xs p-1 transition-all active:scale-95 ${bgClass} ${ringClass}`}
            >
              <span className="text-[11px] leading-tight">{dayNumber}</span>

              {/* Distinct Markings: Star (3) vs. Outstanding (2) */}
              <div className="flex items-center space-x-0.5 absolute bottom-0.5">
                {day?.memorability === 3 && (
                  <Star
                    size={8}
                    className="text-amber-200 fill-amber-200 drop-shadow-xs"
                  />
                )}
                {day?.memorability === 2 && (
                  <Triangle
                    size={7}
                    className="text-indigo-200 fill-indigo-200 drop-shadow-xs"
                  />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
