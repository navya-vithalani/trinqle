import React from 'react'
import { X, Calendar, Activity, ExternalLink } from 'lucide-react'
import type { MetricDefinition, DayMetricPoint } from '../../core/metrics/types'

interface MetricDetailModalProps {
  isOpen: boolean
  metric: MetricDefinition | null
  points: DayMetricPoint[]
  onClose: () => void
  onNavigateToDay?: (date: string) => void
}

export const MetricDetailModal: React.FC<MetricDetailModalProps> = ({
  isOpen,
  metric,
  points,
  onClose,
  onNavigateToDay,
}) => {
  if (!isOpen || !metric) return null

  // Sort descending by date (most recent first)
  const sortedPoints = [...points].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-[440px] bg-[var(--color-surface)] border-t-2 sm:border-2 border-[var(--color-line)] rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
              {metric.questionLabel}
            </span>
            <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-1.5">
              <Activity size={18} className="text-[var(--color-accent)]" />
              {metric.label}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--color-bg)] text-[var(--color-ink-soft)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Daily History Table */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--color-ink-soft)]">
            <span className="flex items-center gap-1">
              <Calendar size={13} />
              Daily History ({sortedPoints.length} days)
            </span>
            <span>Recorded Value</span>
          </div>

          <div className="space-y-1.5">
            {sortedPoints.map((pt, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (onNavigateToDay) {
                    onNavigateToDay(pt.date)
                    onClose()
                  }
                }}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--color-bg)] hover:border-[var(--color-accent)] border border-transparent transition-all cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--color-accent)]">{pt.date}</span>
                  <span className="text-[10px] text-[var(--color-ink-soft)]">
                    {new Date(pt.date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {pt.isMissing ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-line)]/50 text-[var(--color-ink-soft)] font-medium">
                      Missing
                    </span>
                  ) : metric.partKind === 'yesno' ? (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        pt.value === 1
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-rose-500/10 text-rose-600'
                      }`}
                    >
                      {pt.value === 1 ? 'Done' : 'No'}
                    </span>
                  ) : (
                    <span className="font-extrabold text-[var(--color-ink)]">
                      {pt.value} {metric.unit || ''}
                    </span>
                  )}
                  {onNavigateToDay && (
                    <ExternalLink size={12} className="text-[var(--color-ink-soft)]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-line)] text-xs font-bold text-[var(--color-ink)] hover:bg-[var(--color-line)] transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}
