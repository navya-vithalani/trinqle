import React from 'react'
import { X, Calendar, Tag, ExternalLink } from 'lucide-react'
import type { ItemDayAppearance } from '../../core/metrics/types'

interface ItemHistoryModalProps {
  isOpen: boolean
  itemName: string
  libraryName: string
  totalUses: number
  firstUsed: string
  lastUsed: string
  days: ItemDayAppearance[]
  onClose: () => void
  onNavigateToDay?: (date: string) => void
}

export const ItemHistoryModal: React.FC<ItemHistoryModalProps> = ({
  isOpen,
  itemName,
  libraryName,
  totalUses,
  firstUsed,
  lastUsed,
  days,
  onClose,
  onNavigateToDay,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-[440px] bg-[var(--color-surface)] border-t-2 sm:border-2 border-[var(--color-line)] rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
              {libraryName}
            </span>
            <h3 className="text-base font-extrabold text-[var(--color-ink)] flex items-center gap-1.5">
              <Tag size={18} className="text-[var(--color-accent)]" />
              {itemName}
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

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-[var(--color-bg)] text-center text-xs">
          <div>
            <span className="text-[10px] text-[var(--color-ink-soft)] block">Total uses</span>
            <span className="font-extrabold text-[var(--color-ink)]">{totalUses}</span>
          </div>
          <div className="border-x border-[var(--color-line)]">
            <span className="text-[10px] text-[var(--color-ink-soft)] block">First used</span>
            <span className="font-bold text-[var(--color-ink)]">{firstUsed || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--color-ink-soft)] block">Last used</span>
            <span className="font-bold text-[var(--color-ink)]">{lastUsed || '-'}</span>
          </div>
        </div>

        {/* Days List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <div className="text-[11px] font-bold text-[var(--color-ink-soft)] flex items-center gap-1">
            <Calendar size={13} />
            Entries with this item ({days.length})
          </div>

          {days.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--color-ink-soft)]">
              No days found for this item in the selected date scope.
            </div>
          ) : (
            days.map((d, idx) => (
              <div
                key={idx}
                onClick={() => {
                  onNavigateToDay?.(d.date)
                  onClose()
                }}
                className="p-3 rounded-2xl bg-[var(--color-bg)] hover:border-[var(--color-accent)] border border-transparent transition-all cursor-pointer space-y-1 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-accent)] flex items-center gap-1">
                    <Calendar size={12} />
                    {d.date}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-soft)] group-hover:text-[var(--color-accent)] transition-colors">
                    <span>Open day</span>
                    <ExternalLink size={12} />
                  </span>
                </div>

                {d.dayTitle && (
                  <div className="text-xs font-semibold text-[var(--color-ink)]">
                    {d.dayTitle}
                  </div>
                )}

                <div className="text-[10px] text-[var(--color-ink-soft)]">
                  In: <span className="font-medium text-[var(--color-ink)]">{d.questionLabel}</span> • {d.partLabel}
                </div>
              </div>
            ))
          )}
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
