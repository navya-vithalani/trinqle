import React from 'react'
import { Calendar } from 'lucide-react'

export type EditScope = 'nextChapter' | 'thisChapter'

interface ScopePromptModalProps {
  isOpen: boolean
  title: string
  description?: string
  currentChapterTitle?: string
  onSelect: (scope: EditScope) => void
  onCancel: () => void
}

export const ScopePromptModal: React.FC<ScopePromptModalProps> = ({
  isOpen,
  title,
  description,
  currentChapterTitle = 'Current Chapter',
  onSelect,
  onCancel,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--color-surface)] w-full max-w-sm rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl p-5 space-y-4">
        <div className="flex items-center space-x-2">
          <Calendar size={18} className="text-[var(--color-accent)]" />
          <h3 className="font-bold text-sm text-[var(--color-ink)]">{title}</h3>
        </div>

        <p className="text-xs text-[var(--color-ink-soft)] leading-relaxed">
          {description ||
            'Structural edits affect how historical completeness is measured. Choose when this change takes effect:'}
        </p>

        <div className="space-y-2 pt-1">
          {/* Option A: This Chapter (Recommended Default) */}
          <button
            type="button"
            onClick={() => onSelect('thisChapter')}
            className="w-full text-left p-3 rounded-[var(--radius-m)] border-2 border-[var(--color-accent)] bg-[var(--color-bg)] space-y-1 active:scale-98 transition-transform"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[var(--color-ink)]">
                Apply to Current Chapter (Active Now)
              </span>
              <span className="text-[9px] uppercase tracking-wider font-extrabold bg-[var(--color-accent)] text-white px-1.5 py-0.5 rounded-full">
                Recommended
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-ink-soft)]">
              Applies immediately to {currentChapterTitle}. Active and visible in your journal right now.
            </p>
          </button>

          {/* Option B: Next Chapter */}
          <button
            type="button"
            onClick={() => onSelect('nextChapter')}
            className="w-full text-left p-3 rounded-[var(--radius-m)] border border-[var(--color-line)] bg-[var(--color-surface)] hover:border-[var(--color-ink-soft)] space-y-1 active:scale-98 transition-transform"
          >
            <div className="flex items-center space-x-1.5 text-xs font-bold text-[var(--color-ink)]">
              <Calendar size={13} className="text-[var(--color-accent)]" />
              <span>Schedule from Next Chapter</span>
            </div>
            <p className="text-[11px] text-[var(--color-ink-soft)]">
              Keeps current chapter unchanged. Edits take effect automatically when the next chapter starts.
            </p>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="py-1.5 px-4 rounded-[var(--radius-pill)] border border-[var(--color-line)] text-xs font-semibold text-[var(--color-ink-soft)] active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
