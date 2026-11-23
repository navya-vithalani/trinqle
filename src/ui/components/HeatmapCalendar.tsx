import React from 'react'
import { addDays } from '../../core/logicalDay'
import { calculateChapterDuration } from '../../core/chapters'
import type { Chapter, Day } from '../../data/types'
import { Star } from 'lucide-react'

interface HeatmapCalendarProps {
  chapter: Chapter
  days: Day[]
  todayLogicalDate: string
  onSelectDate: (date: string) => void
}

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({
  chapter,
  days,
  todayLogicalDate,
  onSelectDate,
}) => {
  const totalDays = calculateChapterDuration(chapter.startDate, chapter.plannedEndDate)
  const daysMap = new Map<string, Day>()
  days.forEach((d) => daysMap.set(d.date, d))

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
    <div className="sticker-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--color-ink)]">
          Chapter Heatmap ({totalDays} Days)
        </h3>
        <div className="flex items-center space-x-2 text-[10px] text-[var(--color-ink-soft)]">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-[var(--color-accent)] inline-block" />
            <span>Full</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded bg-[var(--color-accent)]/40 inline-block" />
            <span>Quick</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded border border-[var(--color-line)] inline-block" />
            <span>Empty</span>
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {cells.map(({ date, dayNumber, day, isToday, isFuture }) => {
          let bgClass = 'bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-[var(--color-ink)]'

          if (isFuture) {
            bgClass =
              'bg-[var(--color-bg)]/40 border border-dashed border-[var(--color-line)] text-[var(--color-ink-soft)] opacity-40'
          } else if (day) {
            if (day.mode === 'full') {
              bgClass =
                'bg-[var(--color-accent)] border-2 border-[var(--color-accent)] text-white font-bold shadow-sm'
            } else {
              bgClass =
                'bg-[var(--color-accent)]/30 border-2 border-[var(--color-accent)]/60 text-[var(--color-ink)] font-semibold'
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

              {/* Badges: Star or Backfill */}
              <div className="flex items-center space-x-0.5 absolute bottom-0.5">
                {day && day.memorability > 0 && (
                  <Star
                    size={7}
                    className={
                      day.mode === 'full' ? 'text-amber-200 fill-amber-200' : 'text-amber-500 fill-amber-500'
                    }
                  />
                )}
                {day?.backfilled && (
                  <span
                    className={`w-1 h-1 rounded-full ${
                      day.mode === 'full' ? 'bg-white' : 'bg-[var(--color-ink)]'
                    }`}
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
