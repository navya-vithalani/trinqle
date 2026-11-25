import React from 'react'
import { Flame, CheckCircle2, Calendar } from 'lucide-react'
import type { StreakStats, MetricDefinition } from '../../core/metrics/types'

interface YesNoMetricCardProps {
  metric: MetricDefinition
  stats: StreakStats
  onSelect?: () => void
}

export const YesNoMetricCard: React.FC<YesNoMetricCardProps> = ({
  metric,
  stats,
  onSelect,
}) => {
  // Recent 14 history items for compact strip
  const recentHistory = stats.history.slice(-14)

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
            <CheckCircle2 size={16} className="text-[var(--color-accent)] shrink-0" />
            {metric.label}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-bold">
          <Flame size={14} className="animate-pulse" />
          <span>{stats.currentStreak}d streak</span>
        </div>
      </div>

      {/* Completion & Streak Stats */}
      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-xl bg-[var(--color-bg)] text-center">
        <div>
          <div className="text-xs font-bold text-[var(--color-ink)]">{stats.completionRate}%</div>
          <div className="text-[10px] text-[var(--color-ink-soft)]">Done rate</div>
        </div>
        <div className="border-x border-[var(--color-line)]">
          <div className="text-xs font-bold text-[var(--color-ink)]">{stats.longestStreak} days</div>
          <div className="text-[10px] text-[var(--color-ink-soft)]">Longest</div>
        </div>
        <div>
          <div className="text-xs font-bold text-[var(--color-ink)]">{stats.totalDone} / {stats.totalEvaluatedDays}</div>
          <div className="text-[10px] text-[var(--color-ink-soft)]">Logged</div>
        </div>
      </div>

      {/* Compact Heatmap Pill Strip */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] text-[var(--color-ink-soft)]">
          <span className="flex items-center gap-1">
            <Calendar size={11} /> Recent days
          </span>
          <span>{recentHistory.length > 0 ? `${recentHistory[0].date.slice(5)} to ${recentHistory[recentHistory.length - 1].date.slice(5)}` : ''}</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto py-1">
          {recentHistory.map((h, i) => (
            <div
              key={i}
              title={`${h.date}: ${h.done === 'skipped' ? 'Skipped (bridged)' : h.done ? 'Done' : 'Not done'}`}
              className={`h-4 flex-1 min-w-[12px] rounded-sm transition-all ${
                h.done === 'skipped'
                  ? 'bg-[var(--color-line)]/50 border border-dashed border-[var(--color-line)]'
                  : h.done
                  ? 'bg-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
