import React from 'react'
import { Award, Star, Calendar } from 'lucide-react'
import type { MemorabilityStats } from '../../core/metrics/types'

interface MemorabilityCardProps {
  stats: MemorabilityStats
  onNavigateToDay?: (date: string) => void
}

export const MemorabilityCard: React.FC<MemorabilityCardProps> = ({
  stats,
  onNavigateToDay,
}) => {
  return (
    <div className="sticker-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--color-ink-soft)]">
            Chapter Highlights
          </span>
          <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-1.5">
            <Award size={16} className="text-amber-500 shrink-0" />
            Memorability & Rating
          </h3>
        </div>
        <div className="text-right">
          <div className="text-base font-extrabold text-[var(--color-accent)]">
            {stats.avgRating > 0 ? `${stats.avgRating}/10` : '-'}
          </div>
          <div className="text-[10px] text-[var(--color-ink-soft)]">Avg rating</div>
        </div>
      </div>

      {/* 4-level memorability pill counts */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="p-2 rounded-xl bg-[var(--color-bg)]">
          <div className="text-xs font-bold text-[var(--color-ink)]">{stats.normalCount}</div>
          <div className="text-[9px] text-[var(--color-ink-soft)]">Normal</div>
        </div>
        <div className="p-2 rounded-xl bg-[var(--color-bg)]">
          <div className="text-xs font-bold text-blue-500">{stats.notableCount}</div>
          <div className="text-[9px] text-[var(--color-ink-soft)]">Notable</div>
        </div>
        <div className="p-2 rounded-xl bg-[var(--color-bg)]">
          <div className="text-xs font-bold text-purple-500">{stats.outstandingCount}</div>
          <div className="text-[9px] text-[var(--color-ink-soft)]">Outstanding</div>
        </div>
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="text-xs font-bold text-amber-500 flex items-center justify-center gap-0.5">
            <Star size={11} fill="currentColor" /> {stats.starCount}
          </div>
          <div className="text-[9px] text-amber-600 font-medium">Star days</div>
        </div>
      </div>

      {/* Star Timeline */}
      {stats.starTimeline.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold text-[var(--color-ink-soft)] flex items-center gap-1">
            <Star size={11} className="text-amber-500" /> Star day moments
          </span>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {stats.starTimeline.map((item, idx) => (
              <div
                key={idx}
                onClick={() => onNavigateToDay?.(item.date)}
                className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-line)]/50 transition-colors cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-[var(--color-accent)] flex items-center gap-1">
                    <Calendar size={10} />
                    {item.date.slice(5)}
                  </span>
                  <span className="font-medium text-[var(--color-ink)] truncate max-w-[190px]">
                    {item.title}
                  </span>
                </div>
                {item.rating !== undefined && (
                  <span className="text-[10px] font-bold text-[var(--color-ink-soft)]">
                    {item.rating}/10
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
