import React, { useState, useEffect } from 'react'
import { X, Calendar, BookOpen, Check, Shield } from 'lucide-react'
import {
  getPlannedEndBounds,
  calculateChapterDuration,
  isPlannedEndDateValid,
  MIN_CHAPTER_DAYS,
  MAX_CHAPTER_DAYS,
} from '../../core/chapters'
import { formatDate } from '../../core/logicalDay'
import { LIMITS } from '../../core/limits'
import type { Chapter } from '../../data/types'

interface ChapterDetailsModalProps {
  isOpen: boolean
  chapter: Chapter
  chapterIndex: number
  daysRemaining: number
  todayLogicalDate?: string
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
  todayLogicalDate,
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
  const [dateSaved, setDateSaved] = useState(false)
  const [titleSaved, setTitleSaved] = useState(false)

  useEffect(() => {
    setSelectedDate(chapter.plannedEndDate)
    setError(null)
    setDateSaved(false)
  }, [chapter.plannedEndDate, isOpen])

  useEffect(() => {
    setWorkingTitle(chapter.title || `Chapter ${chapterIndex}`)
  }, [chapter.title, chapterIndex, isOpen])

  if (!isOpen) return null

  const effectiveToday = todayLogicalDate || formatDate(new Date())
  const bounds = getPlannedEndBounds(chapter.startDate, effectiveToday)
  const duration = calculateChapterDuration(chapter.startDate, selectedDate)
  const isValidDate =
    bounds.canExtend && isPlannedEndDateValid(chapter.startDate, selectedDate, effectiveToday)
  const canAdjustDate = daysRemaining > 2

  const handleTitleSubmit = async () => {
    if (!workingTitle.trim()) return
    await onSaveTitle(workingTitle.trim())
    setTitleSaved(true)
    setTimeout(() => setTitleSaved(false), 2000)
  }

  const handleDateConfirm = async () => {
    if (!isValidDate) {
      setError(
        `Chapter length must be between ${MIN_CHAPTER_DAYS} and ${MAX_CHAPTER_DAYS} days and at least 3 days after today.`
      )
      return
    }
    setSavingDate(true)
    setError(null)
    try {
      await onSavePlannedEndDate(selectedDate)
      setDateSaved(true)
      setTimeout(() => {
        onClose()
      }, 400)
    } catch (err: any) {
      setError(err?.message || 'Failed to update end date')
      setSavingDate(false)
    }
  }

  const handleDone = async () => {
    const isNewDate = selectedDate !== chapter.plannedEndDate
    const isNewTitle =
      workingTitle.trim().length > 0 &&
      workingTitle.trim() !== (chapter.title || `Chapter ${chapterIndex}`)

    if (isNewDate) {
      if (!isValidDate) {
        setError(
          `Chapter length must be between ${MIN_CHAPTER_DAYS} and ${MAX_CHAPTER_DAYS} days and at least 3 days after today.`
        )
        return
      }
      try {
        await onSavePlannedEndDate(selectedDate)
      } catch (err: any) {
        setError(err?.message || 'Failed to update end date')
        return
      }
    }

    if (isNewTitle) {
      try {
        await onSaveTitle(workingTitle.trim())
      } catch {
        // Proceed to close
      }
    }

    onClose()
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
              maxLength={LIMITS.CHAPTER_NAME}
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
          bounds.canExtend ? (
            <div className="space-y-2 pt-2 border-t border-[var(--color-line)]">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[var(--color-ink)]">
                  Adjust Chapter End Date
                </label>
                <span className="text-[10px] text-[var(--color-ink-soft)]">
                  {MIN_CHAPTER_DAYS}–{MAX_CHAPTER_DAYS} days
                </span>
              </div>
              {/* HTML date input with min and max locks dates outside allowed bounds */}
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
                className="w-full py-2 rounded-[var(--radius-pill)] bg-[var(--color-bg)] border border-[var(--color-line)] text-xs font-bold text-[var(--color-ink)] hover:border-[var(--color-accent)] disabled:opacity-40 active:scale-95 flex items-center justify-center space-x-1.5"
              >
                {dateSaved ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-emerald-600">Saved! Closing...</span>
                  </>
                ) : savingDate ? (
                  <span>Saving...</span>
                ) : (
                  <span>Update End Date</span>
                )}
              </button>
            </div>
          ) : (
            <div className="p-2.5 rounded-[var(--radius-m)] bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
              Chapter end date cannot be extended further (today + 3 days exceeds the {MAX_CHAPTER_DAYS}-day maximum).
            </div>
          )
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
            onClick={handleDone}
            className="w-full py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-ink)] text-white font-bold text-xs active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
