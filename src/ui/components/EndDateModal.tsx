import React, { useState } from 'react'
import { X, Calendar } from 'lucide-react'
import {
  getPlannedEndBounds,
  calculateChapterDuration,
  isPlannedEndDateValid,
  MIN_CHAPTER_DAYS,
  MAX_CHAPTER_DAYS,
} from '../../core/chapters'
import { formatDate } from '../../core/logicalDay'
import type { Chapter } from '../../data/types'

interface EndDateModalProps {
  isOpen: boolean
  chapter: Chapter
  todayLogicalDate?: string
  onClose: () => void
  onSave: (newPlannedEndDate: string) => Promise<void>
}

export const EndDateModal: React.FC<EndDateModalProps> = ({
  isOpen,
  chapter,
  todayLogicalDate,
  onClose,
  onSave,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(chapter.plannedEndDate)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const effectiveToday = todayLogicalDate || formatDate(new Date())
  const bounds = getPlannedEndBounds(chapter.startDate, effectiveToday)
  const duration = calculateChapterDuration(chapter.startDate, selectedDate)
  const isValid =
    bounds.canExtend && isPlannedEndDateValid(chapter.startDate, selectedDate, effectiveToday)

  const handleConfirm = async () => {
    if (!isValid) {
      setError(
        `Chapter length must be between ${MIN_CHAPTER_DAYS} and ${MAX_CHAPTER_DAYS} days and at least 3 days after today.`
      )
      return
    }
    setSaving(true)
    try {
      await onSave(selectedDate)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to update end date')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--color-surface)] w-full max-w-sm rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar size={18} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm text-[var(--color-ink)]">Chapter End Date</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[var(--color-ink-soft)]">
          Adjust the planned duration of this chapter. Chapters must run between {MIN_CHAPTER_DAYS} and {MAX_CHAPTER_DAYS} days.
        </p>

        {!bounds.canExtend ? (
          <div className="p-3 rounded-[var(--radius-m)] bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            This chapter cannot be adjusted further because today + 3 days exceeds the {MAX_CHAPTER_DAYS}-day maximum ({bounds.maxDate}).
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--color-ink)]">
              Planned End Date
            </label>
            <input
              type="date"
              value={selectedDate}
              min={bounds.minDate}
              max={bounds.maxDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setError(null)
              }}
              className="w-full py-2 px-3 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-sm font-semibold text-[var(--color-ink)]"
            />
            <div className="flex items-center justify-between text-xs text-[var(--color-ink-soft)] pt-1">
              <span>Started: {chapter.startDate}</span>
              <span>Duration: <strong>{duration} days</strong></span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-600 font-semibold">{error}</p>
        )}

        <div className="flex items-center space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] active:scale-95"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isValid || saving}
            onClick={handleConfirm}
            className="flex-1 py-2.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-xs sticker-button disabled:opacity-50 active:scale-95"
          >
            {saving ? 'Saving...' : 'Update Date'}
          </button>
        </div>
      </div>
    </div>
  )
}
