import React, { useState, useEffect } from 'react'
import { Sparkles, FileText, Clock, Check, AlertCircle, Eye } from 'lucide-react'
import { NightlyFormModal } from '../form/NightlyFormModal'
import { ImportDialog } from '../dialogs/ImportDialog'
import { ChapterRepository, DayRepository } from '../../data/repositories'
import { importFormPack } from '../../data/formPack/importer'
import starterPackRaw from '../../content/starter-form-pack.json'
import { getCharacter, loadCharacterPreference } from '../../characters/registry'
import {
  logicalDate,
  isWindowOpen,
  addDays,
  DEFAULT_WINDOW,
} from '../../core/logicalDay'
import type { FormPack, Chapter, Day } from '../../data/types'

export const HomeScreen: React.FC = () => {
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null)
  const [todayDay, setTodayDay] = useState<Day | null>(null)
  const [missingDays, setMissingDays] = useState<string[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<string>('')
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [activeCharacterId, setActiveCharacterId] = useState<string>('white-cat')

  const chapterRepo = new ChapterRepository()
  const dayRepo = new DayRepository()

  const now = new Date()
  const todayStr = logicalDate(now, undefined, DEFAULT_WINDOW.endHour)
  const windowOpen = isWindowOpen(now, DEFAULT_WINDOW.startHour, DEFAULT_WINDOW.endHour)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const loadState = async () => {
    setActiveCharacterId(loadCharacterPreference())

    let chapter = await chapterRepo.getOpenChapter()
    if (!chapter) {
      chapter = await chapterRepo.createChapter({
        startDate: todayStr,
        title: 'Chapter 1',
      })
    }
    setActiveChapter(chapter)

    const entry = await dayRepo.getDay(todayStr)
    setTodayDay(entry && !entry.deletedAt ? entry : null)

    const missing: string[] = []
    for (let i = 1; i <= 3; i++) {
      const pastDate = addDays(todayStr, -i)
      if (pastDate >= chapter.startDate) {
        const pastDay = await dayRepo.getDay(pastDate)
        if (!pastDay || pastDay.deletedAt) {
          missing.push(pastDate)
        }
      }
    }
    setMissingDays(missing)
  }

  useEffect(() => {
    loadState()
  }, [])

  const handleUseStarterPack = async () => {
    try {
      await importFormPack(starterPackRaw as unknown as FormPack, 'replace')
      showToast('Sample starter pack imported!')
      loadState()
    } catch {
      showToast('Failed to import starter pack')
    }
  }

  const openFormForDate = (targetDate: string) => {
    setModalDate(targetDate)
    setIsModalOpen(true)
  }

  const currentCharacter = getCharacter(activeCharacterId)

  let chapterDaysLeft = 28
  let chapterDayNumber = 1
  if (activeChapter) {
    const start = new Date(activeChapter.startDate).getTime()
    const end = new Date(activeChapter.plannedEndDate).getTime()
    const current = new Date(todayStr).getTime()
    chapterDayNumber = Math.max(1, Math.round((current - start) / 86400000) + 1)
    chapterDaysLeft = Math.max(0, Math.round((end - current) / 86400000))
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-ink)] text-white text-xs font-semibold py-1.5 px-4 rounded-full shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Chapter Countdown / Top Bar */}
      {activeChapter && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface)] rounded-[var(--radius-m)] border-2 border-[var(--color-line)] text-xs font-medium text-[var(--color-ink-soft)]">
          <span className="font-semibold text-[var(--color-ink)]">
            {activeChapter.title || 'Chapter 1'}
          </span>
          <span>Day {chapterDayNumber} of 28</span>
          <span className="text-[var(--color-accent)] font-semibold">
            {chapterDaysLeft} days left
          </span>
        </div>
      )}

      {/* Tonight's Form Card */}
      <div className="sticker-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock size={18} className="text-[var(--color-accent)]" />
            <h3 className="font-semibold text-sm text-[var(--color-ink)]">Tonight's journal</h3>
          </div>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full border ${
              todayDay
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : windowOpen
                  ? 'bg-[var(--color-accent)] text-white border-transparent'
                  : 'bg-[var(--color-bg)] text-[var(--color-ink-soft)] border-[var(--color-line)]'
            }`}
          >
            {todayDay ? 'Completed' : windowOpen ? 'Open now' : 'Opens at 9 pm'}
          </span>
        </div>

        <p className="text-xs text-[var(--color-ink-soft)]">
          {todayDay
            ? 'You logged your night. You can review or edit anytime during the open chapter.'
            : windowOpen
              ? 'Form is open until 3:00 AM. Fill your nightly structured entry.'
              : 'Window opens at 21:00. Preview or test the form below.'}
        </p>

        <div className="flex items-center space-x-2 pt-1">
          {todayDay ? (
            <button
              type="button"
              onClick={() => openFormForDate(todayStr)}
              className="flex-1 py-2.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-[var(--color-ink)] font-semibold text-xs flex items-center justify-center space-x-1.5 active:scale-95"
            >
              <Check size={14} className="text-[var(--color-success)]" />
              <span>Edit tonight's entry</span>
            </button>
          ) : windowOpen ? (
            <button
              type="button"
              onClick={() => openFormForDate(todayStr)}
              className="flex-1 py-2.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-xs sticker-button flex items-center justify-center space-x-1.5"
            >
              <Sparkles size={14} />
              <span>Fill tonight's form</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openFormForDate(todayStr)}
              className="flex-1 py-2 px-3 rounded-[var(--radius-pill)] bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)] font-semibold text-xs flex items-center justify-center space-x-1.5 active:scale-95"
            >
              <Eye size={14} className="text-[var(--color-accent)]" />
              <span>Preview form (dev mode)</span>
            </button>
          )}
        </div>
      </div>

      {/* Backfill Banner */}
      {missingDays.length > 0 && (
        <div className="p-3 bg-amber-50 rounded-[var(--radius-m)] border border-amber-200 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>
              <strong>{missingDays[0]}</strong> is missing. Backfill it?
            </span>
          </div>
          <button
            type="button"
            onClick={() => openFormForDate(missingDays[0])}
            className="px-2.5 py-1 rounded-full bg-amber-600 text-white font-semibold text-[11px] shrink-0 active:scale-95"
          >
            Fill it
          </button>
        </div>
      )}

      {/* Character Stage */}
      <div className="sticker-card p-6 flex flex-col items-center justify-center min-h-[180px] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-bg)]">
        <div className="w-24 h-24 mb-2 flex items-center justify-center rounded-full bg-[var(--color-line)]/50">
          <img
            src={currentCharacter.svg}
            alt={currentCharacter.name}
            className="w-20 h-20 object-contain hover:scale-105 transition-transform"
          />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            Piqsie ({currentCharacter.name})
          </p>
          <p className="text-xs text-[var(--color-ink-soft)]">
            {currentCharacter.description}
          </p>
        </div>
      </div>

      {/* Form Pack Setup */}
      <div className="sticker-card p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-[var(--color-ink)]">Starter pack</h2>
          <p className="text-xs text-[var(--color-ink-soft)] mt-1">
            Build your personalized journal form or import our disposable starter pack.
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleUseStarterPack}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-semibold text-sm sticker-button"
          >
            <Sparkles size={16} />
            <span>Use sample starter pack</span>
          </button>

          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-[var(--color-ink)] font-medium text-sm"
          >
            <FileText size={16} className="text-[var(--color-accent3)]" />
            <span>Import a form pack</span>
          </button>
        </div>
      </div>

      {/* Nightly Form Modal */}
      {isModalOpen && (
        <NightlyFormModal
          isOpen={isModalOpen}
          date={modalDate}
          chapterId={activeChapter?.id || ''}
          todayLogicalDate={todayStr}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            showToast('Night saved successfully!')
            loadState()
          }}
        />
      )}

      {/* Import Dialog */}
      {isImportOpen && (
        <ImportDialog
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onSuccess={() => {
            showToast('Form pack imported!')
            loadState()
          }}
        />
      )}
    </div>
  )
}
