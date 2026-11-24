import React, { useState } from 'react'
import { Droplets } from 'lucide-react'
import type { Chapter, Day, Cycle } from '../../data/types'
import { HeatmapCalendar } from './HeatmapCalendar'
import { CycleHealthView } from './CycleHealthView'

interface UnifiedCalendarCardProps {
  chapter: Chapter
  days: Day[]
  todayLogicalDate: string
  cycles: Cycle[]
  activeCycle?: Cycle
  onSelectDate: (date: string) => void
  onStartCycle: (date: string) => Promise<void>
  onEndCycle: (cycleId: string, date: string) => Promise<void>
  onUpdateCycle: (cycle: Cycle) => Promise<void>
  onDeleteCycle: (cycleId: string) => Promise<void>
}

export const UnifiedCalendarCard: React.FC<UnifiedCalendarCardProps> = ({
  chapter,
  days,
  todayLogicalDate,
  cycles,
  activeCycle,
  onSelectDate,
  onStartCycle,
  onEndCycle,
  onUpdateCycle,
  onDeleteCycle,
}) => {
  // Default to 'activity' (Journal Activity) per spec
  const [activeSegment, setActiveSegment] = useState<'activity' | 'cycle'>('activity')

  return (
    <div className="sticker-card p-4 space-y-3.5">
      {/* Top Segmented Toggle & Right Action Button */}
      <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
        {/* Segmented Control */}
        <div className="flex items-center p-0.5 rounded-[var(--radius-pill)] bg-[var(--color-bg)] border border-[var(--color-line)]">
          <button
            type="button"
            onClick={() => setActiveSegment('activity')}
            className={`py-1 px-3 rounded-[var(--radius-pill)] text-xs font-bold transition-all ${
              activeSegment === 'activity'
                ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            Journal Activity
          </button>
          <button
            type="button"
            onClick={() => setActiveSegment('cycle')}
            className={`py-1 px-3 rounded-[var(--radius-pill)] text-xs font-bold transition-all ${
              activeSegment === 'cycle'
                ? 'bg-[var(--color-surface)] text-[var(--color-accent)] shadow-xs'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            Cycle & Health
          </button>
        </div>

        {/* Top-Right Action: Only in Cycle & Health view */}
        {activeSegment === 'cycle' && (
          <button
            type="button"
            onClick={() => {
              // Trigger Update Cycle modal inside CycleHealthView
              const btn = document.querySelector<HTMLButtonElement>('[data-update-cycle-trigger]')
              btn?.click()
            }}
            className="py-1 px-3 rounded-[var(--radius-pill)] bg-rose-500 text-white font-bold text-xs sticker-button flex items-center space-x-1 active:scale-95"
          >
            <Droplets size={12} />
            <span>Update Cycle</span>
          </button>
        )}
      </div>

      {/* Hidden button used to trigger Update Cycle modal from top header */}
      <button
        data-update-cycle-trigger
        className="hidden"
        type="button"
        onClick={() => {
          // This will be caught by CycleHealthView or we expose modal trigger
        }}
      />

      {/* Segment 1: Journal Activity Heatmap */}
      {activeSegment === 'activity' && (
        <HeatmapCalendar
          chapter={chapter}
          days={days}
          todayLogicalDate={todayLogicalDate}
          onSelectDate={onSelectDate}
        />
      )}

      {/* Segment 2: Cycle & Health Calendar */}
      {activeSegment === 'cycle' && (
        <CycleHealthView
          cycles={cycles}
          activeCycle={activeCycle}
          todayLogicalDate={todayLogicalDate}
          onStartCycle={onStartCycle}
          onEndCycle={onEndCycle}
          onUpdateCycle={onUpdateCycle}
          onDeleteCycle={onDeleteCycle}
        />
      )}
    </div>
  )
}
