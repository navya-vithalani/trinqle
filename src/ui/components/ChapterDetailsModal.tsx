import React, { useState } from 'react'
import { X, Calendar, BookOpen, Check, Shield } from 'lucide-react'
import {
  getPlannedEndBounds,
  calculateChapterDuration,
  isPlannedEndDateValid,
} from '../../core/chapters'
import type { Chapter } from '../../data/types'

interface ChapterDetailsModalProps {
  isOpen: boolean
  chapter: Chapter
  chapterIndex: number
  daysRemaining: number
  isDevMode?: boolean
  onClose: () => void
  onSaveTitle: (newTitle: string) => Promise<void>
  onSavePlannedEndDate: (newPlannedEndDate: string) => Promise<void>
  onOpenReflections: () => void
  onCloseChapterDev: () => void
}

export const ChapterDetailsModal: React.FC<ChapterDetailsModalProps> = ({
  isOpen,
  chapter,
  chapterIndex,
  daysRemaining,
  isDevMode = false,
  onClose,
  onSaveTitle,
  onSavePlannedEndDate,
  onOpenReflections,
  onCloseChapterDev,
}) => {
  const [workingTitle, setWorkingTitle] = useState<string>(
    chapter.title || `Chapter ${chapterIndex}`
  )
  const [selectedDate, setSelectedDate] = useState<string>(chapter.plannedEndDate)
  const [error, setError] = useState<string | null>(null)
  const [savingDate, setSavingDate] = useState(false)
  const [titleSaved, setTitleSaved] = useState(false)

  if (!isOpen) return null

  const bounds = getPlannedEndBounds(chapter.startDate)
  const duration = calculateChapterDuration(chapter.startDate, selectedDate)
  const isValidDate = isPlannedEndDateValid(chapter.startDate, selectedDate)
  const canAdjustDate = daysRemaining > 2

  const handleTitleSubmit = async () => {
    if (!workingTitle.trim()) return
    await onSaveTitle(workingTitle.trim())
    setTitleSaved(true)
    setTimeout(() => setTitleSaved(false), 2000)
  }

  const handleDateConfirm = async () => {
    if (!isValidDate) {
      setError('Chapter length must be between 20 and 45 days.')
      return
    }
    setSavingDate(true)
    try {
      await onSavePlannedEndDate(selectedDate)
      setError(null)
    } catch (err: any) {
      setError(err?.message || 'Failed to update end date')
    } finally {
      setSavingDate(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--color-surface)] w-full max-w-sm rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2.5">
          <div className="flex items-center space-x-2">
            <Calendar size={18} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm text-[var(--color-ink)]">
              Chapter {chapterIndex} Overview
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. Working Chapter Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-[var(--color-ink)]">
            Working Chapter Name
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={workingTitle}
              onChange={(e) => setWorkingTitle(e.target.value)}
              placeholder="e.g. Health & Habits Reset"
              className="flex-1 py-2 px-3 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)]"
            />
            <button
              type="button"
              onClick={handleTitleSubmit}
              className="py-2 px-3 rounded-[var(--radius-m)] bg-[var(--color-accent)] text-white font-bold text-xs active:scale-95 flex items-center space-x-1"
            >
              {titleSaved ? <Check size={14} /> : <span>Save</span>}
            </button>
          </div>
        </div>

        {/* 2. Date Adjustment Controls (Only when > 2 days remain) */}
        {canAdjustDate ? (
          <div className="space-y-2 pt-2 border-t border-[var(--color-line)]">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-[var(--color-ink)]">
                Adjust Chapter End Date
              </label>
              <span className="text-[10px] text-[var(--color-ink-soft)]">Max 45 days</span>
            </div>
            {/* HTML date input with min and max locks dates >45 days so they are disabled in UI */}
            <input
              type="date"
              value={selectedDate}
              min={bounds.minDate}
              max={bounds.maxDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setError(null)
              }}
              className="w-full py-2 px-3 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)]"
            />
            <div className="flex items-center justify-between text-[11px] text-[var(--color-ink-soft)]">
              <span>Started: {chapter.startDate}</span>
              <span>
                Planned length: <strong>{duration} days</strong>
              </span>
            </div>
            {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
            <button
              type="button"
              disabled={selectedDate === chapter.plannedEndDate || savingDate}
              onClick={handleDateConfirm}
              className="w-full py-2 rounded-[var(--radius-pill)] bg-[var(--color-bg)] border border-[var(--color-line)] text-xs font-bold text-[var(--color-ink)] hover:border-[var(--color-accent)] disabled:opacity-40 active:scale-95"
            >
              {savingDate ? 'Saving...' : 'Update End Date'}
            </button>
          </div>
        ) : (
          <div className="p-2.5 rounded-[var(--radius-m)] bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
            Final 2 days: Chapter end date is locked to ensure smooth closing preparation.
          </div>
        )}

        {/* 3. Chapter Reflections Sheet (Item 23) */}
        <div className="space-y-2 pt-2 border-t border-[var(--color-line)]">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[var(--color-ink)] block">
                Chapter Reflections
              </span>
              <span className="text-[10px] text-[var(--color-ink-soft)]">
                Record thoughts, highlights, and milestones throughout the chapter.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenReflections()
            }}
            className="w-full py-2.5 px-3 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-xs font-semibold text-[var(--color-accent)] flex items-center justify-center space-x-1.5 active:scale-95 hover:border-[var(--color-accent)]"
          >
            <BookOpen size={14} />
            <span>Open Chapter Reflections</span>
          </button>
        </div>

        {/* 4. Dev Mode Troubleshooting: Close Chapter (Item 23) */}
        {isDevMode && (
          <div className="p-3 rounded-[var(--radius-m)] bg-rose-50 border border-rose-200 space-y-1.5 pt-2">
            <div className="flex items-center space-x-1 text-rose-700 font-bold text-[11px]">
              <Shield size={13} />
              <span>Dev Mode Troubleshooting</span>
            </div>
            <p className="text-[10px] text-rose-600">
              Visible only in Dev Mode for testing the full closing ceremony sequence.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose()
                onCloseChapterDev()
              }}
              className="w-full py-1.5 rounded-[var(--radius-pill)] bg-rose-600 text-white font-bold text-[11px] active:scale-95"
            >
              Close Chapter (Dev Test)
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-[var(--color-line)]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-ink)] text-white font-bold text-xs active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
