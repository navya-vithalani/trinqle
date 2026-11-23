import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  FileText,
  Clock,
  Check,
  AlertCircle,
  Eye,
  BookOpen,
  ShieldAlert,
  X,
  Sliders,
} from 'lucide-react'
import { NightlyFormModal } from '../form/NightlyFormModal'
import { ImportDialog } from '../dialogs/ImportDialog'
import { FormEditorScreen } from '../editor/FormEditorScreen'
import {
  ChapterRepository,
  DayRepository,
  CycleRepository,
  FormRepository,
} from '../../data/repositories'
import { importFormPack } from '../../data/formPack/importer'
import starterPackRaw from '../../content/starter-form-pack.json'
import { loadCharacterPreference } from '../../characters/registry'
import {
  logicalDate,
  isWindowOpen,
  addDays,
  DEFAULT_WINDOW,
} from '../../core/logicalDay'
import {
  isChapterHardLocked,
  isPreCloseDue,
  getChapterProgress,
} from '../../core/chapters'
import { buildGreetingContext, evaluateGreetings } from '../../core/greetings'
import { CharacterStage } from '../components/CharacterStage'
import { HeatmapCalendar } from '../components/HeatmapCalendar'
import { CycleCard } from '../components/CycleCard'
import { EndDateModal } from '../components/EndDateModal'
import { ReflectionsSheet } from './ReflectionsSheet'
import { ChapterGate } from './ChapterGate'
import type { FormPack, Chapter, Day, Cycle } from '../../data/types'

export const HomeScreen: React.FC = () => {
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null)
  const [todayDay, setTodayDay] = useState<Day | null>(null)
  const [chapterDays, setChapterDays] = useState<Day[]>([])
  const [missingDays, setMissingDays] = useState<string[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [activeCycle, setActiveCycle] = useState<Cycle | undefined>(undefined)
  const [reflectionsAnsweredCount, setReflectionsAnsweredCount] = useState(0)
  const [reflectionsTotalCount, setReflectionsTotalCount] = useState(0)

  // Modals & Sheets
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<string>('')
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isEndDateModalOpen, setIsEndDateModalOpen] = useState(false)
  const [isReflectionsOpen, setIsReflectionsOpen] = useState(false)
  const [isChapterGateOpen, setIsChapterGateOpen] = useState(false)
  const [isFormEditorOpen, setIsFormEditorOpen] = useState(false)
  const [preCloseDismissed, setPreCloseDismissed] = useState(false)

  // Greetings & Character
  const [greetingText, setGreetingText] = useState<string>('')
  const [activeCharacterId, setActiveCharacterId] = useState<string>('white-cat')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const chapterRepo = new ChapterRepository()
  const dayRepo = new DayRepository()
  const cycleRepo = new CycleRepository()
  const formRepo = new FormRepository()

  const now = new Date()
  const todayStr = logicalDate(now, undefined, DEFAULT_WINDOW.endHour)
  const windowOpen = isWindowOpen(now, DEFAULT_WINDOW.startHour, DEFAULT_WINDOW.endHour)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const loadState = async () => {
    setActiveCharacterId(loadCharacterPreference())

    // 1. Get or initialize open chapter
    let chapter = await chapterRepo.getOpenChapter()
    if (!chapter) {
      chapter = await chapterRepo.createChapter({
        startDate: todayStr,
        title: 'Chapter 1',
      })
    }
    setActiveChapter(chapter)

    // Check hard-lock
    if (isChapterHardLocked(chapter, todayStr)) {
      setIsChapterGateOpen(true)
    }

    // 2. Load today day
    const entry = await dayRepo.getDay(todayStr)
    setTodayDay(entry && !entry.deletedAt ? entry : null)

    // 3. Load all days for this chapter
    const allDaysInChapter = await dayRepo.getDaysInDateRange(
      chapter.startDate,
      chapter.plannedEndDate
    )
    setChapterDays(allDaysInChapter)

    // 4. Missing past days for backfill banner
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

    // 5. Menstrual Cycles
    const allCycles = await cycleRepo.getAllCycles()
    setCycles(allCycles)
    const currentActiveCycle = await cycleRepo.getActiveCycle()
    setActiveCycle(currentActiveCycle)

    // 6. Reflections Count
    const snapshot = await formRepo.getSnapshot(chapter.startDate)
    const chapterEndSecs = new Set(
      snapshot.sections.filter((s) => s.scope === 'chapterEnd').map((s) => s.id)
    )
    const reflQuestions = snapshot.questions.filter((q) => chapterEndSecs.has(q.sectionId))
    const reflQIds = new Set(reflQuestions.map((q) => q.id))
    const reflParts = snapshot.parts.filter((p) => reflQIds.has(p.questionId))
    const customPrompts = chapter.customPrompts || []
    const totalPrompts = reflParts.length + customPrompts.length
    setReflectionsTotalCount(totalPrompts)

    const answers = await chapterRepo.getChapterAnswers(chapter.id)
    const answered = answers.filter(
      (a) => a.value !== undefined && a.value !== null && a.value !== ''
    ).length
    setReflectionsAnsweredCount(answered)

    // 7. Greetings Engine
    try {
      const { context, dateStr } = await buildGreetingContext(now)
      const greeting = evaluateGreetings(context, dateStr)
      setGreetingText(greeting.text)
    } catch {
      setGreetingText('Welcome back.')
    }
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

  const handleStartCycle = async (date: string) => {
    await cycleRepo.startCycle(date)
    showToast('Cycle started')
    loadState()
  }

  const handleEndCycle = async (cycleId: string, date: string) => {
    await cycleRepo.endCycle(cycleId, date)
    showToast('Cycle ended')
    loadState()
  }

  const handleSavePlannedEndDate = async (newDate: string) => {
    if (!activeChapter) return
    const updated = await chapterRepo.updatePlannedEndDate(activeChapter.id, newDate)
    setActiveChapter(updated)
    showToast('Chapter end date updated!')
    loadState()
  }

  const progress = activeChapter
    ? getChapterProgress(activeChapter, todayStr)
    : { currentDayNumber: 1, totalDays: 28, daysRemaining: 27 }

  const showPreClose =
    activeChapter &&
    isPreCloseDue(activeChapter, todayStr) &&
    !preCloseDismissed &&
    !isChapterGateOpen

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
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[var(--color-ink)]">
              {activeChapter.title || 'Chapter 1'}
            </span>
            <button
              type="button"
              onClick={() => setIsEndDateModalOpen(true)}
              className="text-[10px] text-[var(--color-accent)] font-semibold underline underline-offset-2 active:scale-95"
            >
              Adjust
            </button>
          </div>

          <span>
            Day {progress.currentDayNumber} of {progress.totalDays}
          </span>

          <div className="flex items-center space-x-2">
            <span className="text-[var(--color-accent)] font-semibold">
              {progress.daysRemaining} days left
            </span>
            <button
              type="button"
              onClick={() => setIsChapterGateOpen(true)}
              className="text-[10px] bg-[var(--color-bg)] border border-[var(--color-line)] px-2 py-0.5 rounded text-[var(--color-ink)] font-semibold active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pre-close Dismissible Banner (T-2 days) */}
      {showPreClose && (
        <div className="p-3.5 bg-amber-50 rounded-[var(--radius-m)] border-2 border-amber-300 flex items-start justify-between text-xs text-amber-900 shadow-sm animate-in fade-in duration-150">
          <div className="flex items-start space-x-2.5">
            <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">This chapter wraps up soon.</p>
              <p className="text-[11px] text-amber-800">
                You have {progress.daysRemaining} days remaining. Review your reflections and prepare photos for the ceremony.
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsReflectionsOpen(true)}
                  className="px-2.5 py-1 rounded-full bg-amber-600 text-white font-semibold text-[11px] active:scale-95"
                >
                  Review Reflections
                </button>
                <button
                  type="button"
                  onClick={() => setIsChapterGateOpen(true)}
                  className="px-2.5 py-1 rounded-full bg-amber-100 border border-amber-400 text-amber-900 font-semibold text-[11px] active:scale-95"
                >
                  Close Early
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPreCloseDismissed(true)}
            className="p-1 text-amber-700 hover:text-amber-900 active:scale-90"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Character Stage with Live Greeting */}
      <CharacterStage
        characterId={activeCharacterId}
        greetingText={greetingText}
      />

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

      {/* Chapter Reflections Row */}
      {activeChapter && (
        <div
          onClick={() => setIsReflectionsOpen(true)}
          className="sticker-card p-3.5 flex items-center justify-between cursor-pointer hover:border-[var(--color-accent)] transition-all active:scale-98"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] flex items-center justify-center shrink-0">
              <BookOpen size={16} />
            </div>
            <div>
              <h4 className="font-bold text-xs text-[var(--color-ink)]">
                Chapter Reflections
              </h4>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {reflectionsAnsweredCount} of {reflectionsTotalCount || 7} prompts answered
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold text-[var(--color-accent)]">
            Open &rarr;
          </span>
        </div>
      )}

      {/* Open Chapter Fill Heatmap */}
      {activeChapter && (
        <HeatmapCalendar
          chapter={activeChapter}
          days={chapterDays}
          todayLogicalDate={todayStr}
          onSelectDate={openFormForDate}
        />
      )}

      {/* Menstrual Cycle Card */}
      <CycleCard
        cycles={cycles}
        activeCycle={activeCycle}
        todayLogicalDate={todayStr}
        onStartCycle={handleStartCycle}
        onEndCycle={handleEndCycle}
      />

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
            onClick={() => setIsFormEditorOpen(true)}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-[var(--color-ink)] font-medium text-sm active:scale-95"
          >
            <Sliders size={16} className="text-[var(--color-accent)]" />
            <span>Customize form in Editor</span>
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

      {/* End Date Adjustment Modal */}
      {isEndDateModalOpen && activeChapter && (
        <EndDateModal
          isOpen={isEndDateModalOpen}
          chapter={activeChapter}
          onClose={() => setIsEndDateModalOpen(false)}
          onSave={handleSavePlannedEndDate}
        />
      )}

      {/* Reflections Sheet */}
      {isReflectionsOpen && activeChapter && (
        <ReflectionsSheet
          isOpen={isReflectionsOpen}
          chapter={activeChapter}
          onClose={() => {
            setIsReflectionsOpen(false)
            loadState()
          }}
        />
      )}

      {/* Chapter Closing Ceremony Gate */}
      {isChapterGateOpen && activeChapter && (
        <ChapterGate
          isOpen={isChapterGateOpen}
          chapter={activeChapter}
          todayLogicalDate={todayStr}
          onChapterClosed={(next) => {
            setIsChapterGateOpen(false)
            setActiveChapter(next)
            showToast(`Chapter closed! Welcome to ${next.title || 'Next Chapter'}`)
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

      {/* Form Editor Screen */}
      {isFormEditorOpen && (
        <FormEditorScreen
          isOpen={isFormEditorOpen}
          onClose={() => {
            setIsFormEditorOpen(false)
            loadState()
          }}
        />
      )}
    </div>
  )
}
