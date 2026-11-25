import React from 'react'
import { Tag, ChevronRight } from 'lucide-react'
import type { LibraryStats, MetricDefinition, LibraryItemUsage } from '../../core/metrics/types'

interface LibraryMetricCardProps {
  metric: MetricDefinition
  stats: LibraryStats
  onSelectItem?: (item: LibraryItemUsage) => void
  onSelect?: () => void
}

export const LibraryMetricCard: React.FC<LibraryMetricCardProps> = ({
  metric,
  stats,
  onSelectItem,
  onSelect,
}) => {
  const topItems = stats.topItems.slice(0, 6)
  const maxCount = topItems[0]?.count || 1

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
            <Tag size={16} className="text-[var(--color-accent)] shrink-0" />
            {metric.label}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-base font-extrabold text-[var(--color-accent)]">
            {stats.totalUsages}
          </div>
          <div className="text-[10px] text-[var(--color-ink-soft)]">Total tags</div>
        </div>
      </div>

      {/* Top items frequency bars */}
      {topItems.length > 0 ? (
        <div className="space-y-2 pt-1">
          {topItems.map((item) => {
            const pct = Math.max(8, Math.round((item.count / maxCount) * 100))
            return (
              <div
                key={item.itemId}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectItem?.(item)
                }}
                className="group p-1.5 rounded-lg hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs pb-1">
                  <span className="font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                    {item.name}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-ink-soft)]">
                    {item.count} {item.count === 1 ? 'time' : 'times'}
                    <ChevronRight size={13} className="text-[var(--color-ink-soft)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                </div>
                <div className="h-2 w-full bg-[var(--color-bg)] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className="h-full rounded-full bg-[var(--color-accent)] transition-all"
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-[var(--color-ink-soft)]">
          No tags logged in this time scope.
        </div>
      )}
    </div>
  )
}
