import React, { useState } from 'react'
import { Calendar, ChevronDown, ChevronUp, ExternalLink, Star } from 'lucide-react'
import type { JournalTextEntry } from '../../core/metrics/types'

interface TextJournalCardProps {
  entry: JournalTextEntry
  onNavigateToDay?: (date: string) => void
}

export const TextJournalCard: React.FC<TextJournalCardProps> = ({
  entry,
  onNavigateToDay,
}) => {
  const [expanded, setExpanded] = useState(false)
  const isLong = entry.text.length > 180

  const displayText = expanded || !isLong ? entry.text : `${entry.text.slice(0, 180)}...`

  return (
    <div className="sticker-card p-4 space-y-2.5 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-bg)] text-[10px] font-semibold text-[var(--color-ink)] border border-[var(--color-line)]">
              <Calendar size={11} className="text-[var(--color-accent)]" />
              {entry.date}
            </span>
            <span className="text-[10px] font-medium text-[var(--color-accent)] px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10">
              {entry.questionLabel} • {entry.partLabel}
            </span>
            {entry.memorability === 3 && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold">
                <Star size={10} fill="currentColor" /> Star
              </span>
            )}
          </div>
          {entry.dayTitle && (
            <h4 className="text-xs font-bold text-[var(--color-ink)] pt-1">
              {entry.dayTitle}
            </h4>
          )}
        </div>
        <div className="text-[10px] text-[var(--color-ink-soft)] font-medium shrink-0">
          {entry.wordCount} words
        </div>
      </div>

      {/* Entry Body */}
      <div className="text-xs text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap bg-[var(--color-bg)]/50 p-2.5 rounded-xl border border-[var(--color-line)]/50">
        {displayText}
      </div>

      <div className="flex items-center justify-between pt-0.5">
        {isLong ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-accent)] hover:underline"
          >
            {expanded ? (
              <>
                <ChevronUp size={13} /> Show less
              </>
            ) : (
              <>
                <ChevronDown size={13} /> Read more
              </>
            )}
          </button>
        ) : (
          <div />
        )}

        {onNavigateToDay && (
          <button
            type="button"
            onClick={() => onNavigateToDay(entry.date)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] transition-colors"
          >
            <ExternalLink size={12} />
            <span>Open day</span>
          </button>
        )}
      </div>
    </div>
  )
}
