import React from 'react'
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Flame,
} from 'lucide-react'
import type { Chapter, FrozenChartModel } from '../../data/types'

interface FrozenDashboardViewProps {
  chapter: Chapter
  onExitArchive: () => void
}

export const FrozenDashboardView: React.FC<FrozenDashboardViewProps> = ({
  chapter,
  onExitArchive,
}) => {
  const chartModels: FrozenChartModel[] = chapter.frozen?.dashboard || []

  return (
    <div className="space-y-4 pb-20">
      {/* Return to Live Banner */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--color-surface)] border-2 border-[var(--color-line)] shadow-xs">
        <button
          type="button"
          onClick={onExitArchive}
          className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] hover:underline"
        >
          <ArrowLeft size={16} />
          <span>Exit Archive Mode</span>
        </button>
        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-line)] text-[var(--color-ink)]">
          <Lock size={10} /> Frozen Snapshot
        </span>
      </div>

      <div className="sticker-card p-4 space-y-1">
        <h2 className="text-base font-bold text-[var(--color-ink)]">
          Frozen Dashboard: {chapter.title || 'Archived Chapter'}
        </h2>
        <p className="text-xs text-[var(--color-ink-soft)]">
          These charts were preserved at the closing ceremony and reflect the exact metrics and
          formulae effective at that time.
        </p>
      </div>

      {chartModels.length === 0 ? (
        <div className="sticker-card p-8 text-center text-xs text-[var(--color-ink-soft)]">
          No frozen charts were stored with this chapter.
        </div>
      ) : (
        chartModels.map((chart) => {
          if (chart.type === 'line') {
            const series = (chart.series[0] as any) || {}
            const data: Array<number | null> = series.data || []
            const valid = data.filter((v): v is number => v !== null)
            const min = series.min ?? (valid.length > 0 ? Math.min(...valid) : 0)
            const max = series.max ?? (valid.length > 0 ? Math.max(...valid) : 10)
            const mean = series.mean ?? 0

            return (
              <div key={chart.chartId} className="sticker-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                    <TrendingUp size={16} className="text-[var(--color-accent)]" />
                    {series.name || 'Metric'}
                  </h3>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-[var(--color-accent)]">
                      {mean} {series.unit || ''}
                    </span>
                    <span className="text-[10px] text-[var(--color-ink-soft)] block">Mean</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs py-1 px-3 rounded-xl bg-[var(--color-bg)]">
                  <div>
                    <span className="text-[10px] text-[var(--color-ink-soft)] block">Min</span>
                    <span className="font-bold text-[var(--color-ink)]">{min}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--color-ink-soft)] block">Max</span>
                    <span className="font-bold text-[var(--color-ink)]">{max}</span>
                  </div>
                </div>

                {/* Compact sparkline bar view */}
                <div className="flex items-end gap-1 h-16 bg-[var(--color-bg)] p-2 rounded-xl overflow-x-auto">
                  {data.map((val, idx) => {
                    const pct =
                      val !== null && max > min
                        ? Math.max(10, Math.min(100, ((val - min) / (max - min || 1)) * 100))
                        : 0
                    return (
                      <div
                        key={idx}
                        title={`${chart.labels?.[idx] || ''}: ${val ?? 'missing'}`}
                        style={{ height: `${pct}%` }}
                        className={`flex-1 min-w-[8px] rounded-xs ${
                          val !== null ? 'bg-[var(--color-accent)]' : 'bg-transparent border border-dashed border-[var(--color-line)]'
                        }`}
                      />
                    )
                  })}
                </div>
              </div>
            )
          }

          if (chart.type === 'heatmap_streak') {
            const series = (chart.series[0] as any) || {}
            const history: Array<{ date: string; done: boolean | 'skipped' }> =
              series.history || []

            return (
              <div key={chart.chartId} className="sticker-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-[var(--color-accent)]" />
                    {series.name || 'Habit'}
                  </h3>
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-bold">
                    <Flame size={13} />
                    <span>{series.currentStreak ?? 0}d streak</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs py-1.5 px-3 rounded-xl bg-[var(--color-bg)]">
                  <div>
                    <span className="text-[10px] text-[var(--color-ink-soft)] block">Done rate</span>
                    <span className="font-bold text-[var(--color-ink)]">
                      {series.completionRate ?? 0}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--color-ink-soft)] block">Longest</span>
                    <span className="font-bold text-[var(--color-ink)]">
                      {series.longestStreak ?? 0}d
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--color-ink-soft)] block">Total done</span>
                    <span className="font-bold text-[var(--color-ink)]">
                      {series.totalDone ?? 0}
                    </span>
                  </div>
                </div>

                {/* Heatmap Strip */}
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                  {history.map((h, i) => (
                    <div
                      key={i}
                      title={`${h.date}: ${h.done === 'skipped' ? 'Skipped' : h.done ? 'Done' : 'No'}`}
                      className={`h-4 flex-1 min-w-[10px] rounded-xs ${
                        h.done === 'skipped'
                          ? 'border border-dashed border-[var(--color-line)]'
                          : h.done
                          ? 'bg-[var(--color-accent)]'
                          : 'bg-[var(--color-bg)] border border-[var(--color-line)]'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )
          }

          if (chart.type === 'time_distribution') {
            const series = (chart.series[0] as any) || {}
            const hourBins: number[] = series.hourBins || new Array(24).fill(0)
            const maxMins = Math.max(...hourBins, 1)

            return (
              <div key={chart.chartId} className="sticker-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                    <Clock size={16} className="text-[var(--color-accent)]" />
                    {series.name || 'Time Range'}
                  </h3>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-[var(--color-accent)]">
                      {Math.floor((series.totalMinutes || 0) / 60)}h {(series.totalMinutes || 0) % 60}m
                    </span>
                    <span className="text-[10px] text-[var(--color-ink-soft)] block">Total</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-1 bg-[var(--color-bg)] p-2 rounded-xl">
                  {hourBins.map((mins, h) => {
                    const opacity = mins > 0 ? Math.max(0.2, mins / maxMins) : 0
                    return (
                      <div
                        key={h}
                        title={`${String(h).padStart(2, '0')}:00 - ${mins} mins`}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <div
                          style={{
                            backgroundColor: mins > 0 ? 'var(--color-accent)' : 'transparent',
                            opacity: mins > 0 ? opacity : 1,
                          }}
                          className={`w-full h-4 rounded-xs ${
                            mins === 0 ? 'border border-dashed border-[var(--color-line)]' : ''
                          }`}
                        />
                        <span className="text-[8px] text-[var(--color-ink-soft)]">
                          {h % 6 === 0 ? h : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }

          return null
        })
      )}
    </div>
  )
}
