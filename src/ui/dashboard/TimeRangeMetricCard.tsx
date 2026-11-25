import React from 'react'
import { Clock, Sun, Moon } from 'lucide-react'
import type { TimeRangeStats, MetricDefinition } from '../../core/metrics/types'

interface TimeRangeMetricCardProps {
  metric: MetricDefinition
  stats: TimeRangeStats
  onSelect?: () => void
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export const TimeRangeMetricCard: React.FC<TimeRangeMetricCardProps> = ({
  metric,
  stats,
  onSelect,
}) => {
  const maxHourMins = Math.max(...stats.hourBins, 1)

  return (
    <div
      onClick={onSelect}
      className="sticker-card p-4 space-y-3 cursor-pointer hover:border-[var(--color-accent)] transition-colors active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--color-ink-soft)]">
            {metric.questionLabel}
          </span>
          <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-1.5">
            <Clock size={16} className="text-[var(--color-accent)] shrink-0" />
            {metric.label}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-base font-extrabold text-[var(--color-accent)]">
            {formatMinutes(stats.totalMinutes)}
          </div>
          <div className="text-[10px] text-[var(--color-ink-soft)]">Total time</div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 py-1.5 px-3 rounded-xl bg-[var(--color-bg)] text-center text-xs">
        <div>
          <span className="text-[10px] text-[var(--color-ink-soft)] block">Daily avg</span>
          <span className="font-bold text-[var(--color-ink)]">
            {formatMinutes(stats.avgMinutesPerDay)}
          </span>
        </div>
        <div className="border-x border-[var(--color-line)]">
          <span className="text-[10px] text-[var(--color-ink-soft)] block">Avg session</span>
          <span className="font-bold text-[var(--color-ink)]">
            {formatMinutes(stats.avgSessionMinutes)}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-ink-soft)] block">Sessions</span>
          <span className="font-bold text-[var(--color-ink)]">{stats.sessionCount}</span>
        </div>
      </div>

      {/* 24-hour time-of-day heatmap (00:00 to 23:00) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] text-[var(--color-ink-soft)]">
          <span className="flex items-center gap-1 font-semibold">
            <Moon size={11} /> 24h Time-of-day distribution
          </span>
          <span className="flex items-center gap-1">
            <Sun size={11} /> Peak: {String(stats.peakHour).padStart(2, '0')}:00
          </span>
        </div>

        {/* 24 hour blocks grid: 4 rows of 6 or 2 rows of 12 */}
        <div className="grid grid-cols-12 gap-1 bg-[var(--color-bg)] p-2 rounded-xl">
          {stats.hourBins.map((mins, hour) => {
            const opacity = mins > 0 ? Math.max(0.2, Math.min(1, mins / maxHourMins)) : 0
            return (
              <div
                key={hour}
                title={`${String(hour).padStart(2, '0')}:00 - ${mins} mins`}
                className="flex flex-col items-center gap-0.5"
              >
                <div
                  style={{
                    backgroundColor: mins > 0 ? 'var(--color-accent)' : 'transparent',
                    opacity: mins > 0 ? opacity : 1,
                  }}
                  className={`w-full h-5 rounded-xs transition-all ${
                    mins === 0 ? 'bg-[var(--color-line)]/40 border border-dashed border-[var(--color-line)]' : ''
                  }`}
                />
                <span className="text-[8px] text-[var(--color-ink-soft)]">
                  {hour % 6 === 0 ? hour : ''}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex justify-between text-[9px] text-[var(--color-ink-soft)] px-1">
          <span>00:00 Night</span>
          <span>06:00 Morning</span>
          <span>12:00 Noon</span>
          <span>18:00 Eve</span>
          <span>23:00</span>
        </div>
      </div>
    </div>
  )
}
