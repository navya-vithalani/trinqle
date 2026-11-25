import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  FileText,
  Clock,
  AlertCircle,
  Eye,
  ShieldAlert,
  Sliders,
  ChevronRight,
} from 'lucide-react'
import { NightlyFormModal } from '../form/NightlyFormModal'
import { ImportDialog } from '../dialogs/ImportDialog'
import { FormEditorScreen } from '../editor/FormEditorScreen'
import {
  ChapterRepository,
  DayRepository,
  CycleRepository,
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
  getChapterProgress,
} from '../../core/chapters'
import { buildGreetingContext, evaluateGreetings } from '../../core/greetings'
import { CharacterStage } from '../components/CharacterStage'
import { UnifiedCalendarCard } from '../components/UnifiedCalendarCard'
import { ChapterDetailsModal } from '../components/ChapterDetailsModal'
import { ReflectionsSheet } from './ReflectionsSheet'
import { ChapterGate } from './ChapterGate'
import type { FormPack, Chapter, Day, Cycle } from '../../data/types'

interface HomeScreenProps {
  onNavigateToProfileBrowse?: (date: string) => void
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToProfileBrowse }) => {
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null)
  const [allChaptersCount, setAllChaptersCount] = useState(1)
  const [todayDay, setTodayDay] = useState<Day | null>(null)
  const [chapterDays, setChapterDays] = useState<Day[]>([])
  const [missingDays, setMissingDays] = useState<string[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [activeCycle, setActiveCycle] = useState<Cycle | undefined>(undefined)

  // Modals & Sheets
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalDate, setModalDate] = useState<string>('')
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isChapterDetailsOpen, setIsChapterDetailsOpen] = useState(false)
  const [isReflectionsOpen, setIsReflectionsOpen] = useState(false)
  const [isChapterGateOpen, setIsChapterGateOpen] = useState(false)
  const [isFormEditorOpen, setIsFormEditorOpen] = useState(false)
  const [isDevMode] = useState(false)

  // Greetings & Character
  const [greetingText, setGreetingText] = useState<string>('')
  const [activeCharacterId, setActiveCharacterId] = useState<string>('white-cat')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const chapterRepo = new ChapterRepository()
  const dayRepo = new DayRepository()
  const cycleRepo = new CycleRepository()

  const now = new Date()
  const todayStr = logicalDate(now, undefined, DEFAULT_WINDOW.endHour)
  const windowOpen = isWindowOpen(now, DEFAULT_WINDOW.startHour, DEFAULT_WINDOW.endHour)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const loadState = async () => {
    setActiveCharacterId(loadCharacterPreference())

    // 1. Get all chapters to accurately compute current chapter number
    const allChapters = await chapterRepo.getAllChapters()
    const activeCh = await chapterRepo.getOpenChapter()
    let chapter = activeCh

    if (!chapter) {
      const nextNum = allChapters.length + 1
      chapter = await chapterRepo.createChapter({
        startDate: todayStr,
        title: `Chapter ${nextNum}`,
      })
      allChapters.push(chapter)
    }

    const currentChapterIdx =
      allChapters.findIndex((c) => c.id === chapter?.id) + 1 || allChapters.length || 1
    setAllChaptersCount(currentChapterIdx)
    setActiveChapter(chapter)

    // Check hard-lock (ceremony on scheduled closing date)
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

    // 6. Greetings Engine
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
      await importFormPack(starterPackRaw as unknown as FormPack)
      showToast('Starter form pack imported successfully!')
      loadState()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Error importing pack')
    }
  }

  const openFormForDate = (targetDate: string) => {
    setModalDate(targetDate)
    setIsModalOpen(true)
  }

  const handleSaveChapterTitle = async (newTitle: string) => {
    if (!activeChapter) return
    const updated = { ...activeChapter, title: newTitle, updatedAt: Date.now() }
    await chapterRepo.updateChapter(updated)
    setActiveChapter(updated)
    showToast('Chapter name updated')
  }

  const handleSavePlannedEndDate = async (newPlannedEndDate: string) => {
    if (!activeChapter) return
    const updated = await chapterRepo.updatePlannedEndDate(
      activeChapter.id,
      newPlannedEndDate
    )
    setActiveChapter(updated)
    showToast('Chapter end date updated!')
    loadState()
  }

  const handleStartCycle = async (dateStr: string) => {
    await cycleRepo.startCycle(dateStr)
    showToast('Period start logged')
    loadState()
  }

  const handleEndCycle = async (cycleId: string, dateStr: string) => {
    await cycleRepo.endCycle(cycleId, dateStr)
    showToast('Period ended')
    loadState()
  }

  const handleUpdateCycle = async (c: Cycle) => {
    await cycleRepo.updateCycle(c)
    showToast('Cycle updated')
    loadState()
  }

  const handleDeleteCycle = async (cycleId: string) => {
    await cycleRepo.deleteCycle(cycleId)
    showToast('Cycle record deleted')
    loadState()
  }

  const handleSavePastCycle = async (startDate: string, endDate: string) => {
    await cycleRepo.createCompletedCycle(startDate, endDate)
    showToast('Past cycle backfilled successfully')
    loadState()
  }

  const handleHeatmapSelectDate = (targetDate: string) => {
    if (targetDate < todayStr && onNavigateToProfileBrowse) {
      onNavigateToProfileBrowse(targetDate)
    } else {
      openFormForDate(targetDate)
    }
  }

  const progress = activeChapter
    ? getChapterProgress(activeChapter, todayStr)
    : { currentDayNumber: 1, totalDays: 28, daysRemaining: 27 }

  const isFinalTwoDays = progress.daysRemaining <= 2
  const chapterWorkingName =
    activeChapter?.title || `Chapter ${allChaptersCount}`

  return (
    <div className="space-y-4 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-ink)] text-white text-xs font-semibold py-1.5 px-4 rounded-full shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Redesigned Chapter Banner (Items 21 & 22) */}
      {activeChapter && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsChapterDetailsOpen(true)}
          className={`cursor-pointer transition-all select-none active:scale-[0.99] ${
            isFinalTwoDays
              ? 'p-3.5 bg-amber-500 text-white rounded-[var(--radius-m)] shadow-md border-2 border-amber-600 space-y-1'
              : 'px-4 py-2.5 bg-[var(--color-surface)] rounded-[var(--radius-m)] border-2 border-[var(--color-line)] shadow-xs hover:border-[var(--color-accent)]'
          }`}
        >
          {isFinalTwoDays ? (
            /* Final 2 Days Prominent Warning Alert (Item 22 Exception) */
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert size={18} className="text-white shrink-0" />
                <div>
                  <h4 className="font-extrabold text-xs">
                    {chapterWorkingName} wraps up in {progress.daysRemaining} days!
                  </h4>
                  <p className="text-[11px] text-amber-100">
                    Prepare your closing ceremony and reflections now.
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-white shrink-0" />
            </div>
          ) : (
            /* Standard Clean Centered Banner (Item 22) */
            <div className="flex items-center justify-between text-xs">
              <span className="text-[11px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider">
                Day {progress.currentDayNumber}/{progress.totalDays}
              </span>

              {/* Centered Working Name */}
              <span className="font-extrabold text-sm text-[var(--color-ink)] text-center px-2 truncate">
                {chapterWorkingName}
              </span>

              {/* X Days To Go on Right */}
              <span className="text-xs font-bold text-[var(--color-accent)] shrink-0">
                {progress.daysRemaining} days to go
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tonight's Form Card - MOVED ABOVE CHARACTER (Item 25) */}
      <div className="sticker-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock size={18} className="text-[var(--color-accent)]" />
            <h3 className="font-semibold text-sm text-[var(--color-ink)]">Tonight's journal</h3>
          </div>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full border ${
              todayDay
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                : windowOpen
                  ? 'bg-[var(--color-accent)] text-white border-transparent font-bold'
                  : 'bg-[var(--color-bg)] text-[var(--color-ink-soft)] border-[var(--color-line)]'
            }`}
          >
            {todayDay ? 'Completed' : windowOpen ? 'Open now' : 'Opens at 9 pm'}
          </span>
        </div>

        {/* Removed Edit Form and View Form buttons after submission (Item 1) */}
        {todayDay ? (
          <div> 
          </div>
        ) : (
          <>
            <p className="text-xs text-[var(--color-ink-soft)]">
              {windowOpen
                ? 'Form is open for tonight!'
                : 'Window opens at 21:00.'}
            </p>

            <div className="flex items-center space-x-2 pt-1">
              {windowOpen ? (
                <button
                  type="button"
                  onClick={() => openFormForDate(todayStr)}
                  className="flex-1 py-2.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-xs sticker-button flex items-center justify-center space-x-1.5 active:scale-95 shadow-md"
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
                  <span>Preview form (early test)</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Backfill Banner */}
      {missingDays.length > 0 && (
        <div className="p-3 bg-amber-50 rounded-[var(--radius-m)] border border-amber-200 flex items-center justify-between text-xs text-amber-900 shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0" />
            <span>
              <strong>{missingDays[0]}</strong> was not filled.
            </span>
          </div>
          <button
            type="button"
            onClick={() => openFormForDate(missingDays[0])}
            className="px-3 py-1 rounded-full bg-amber-600 text-white font-bold text-[11px] shrink-0 active:scale-95"
          >
            Backfill
          </button>
        </div>
      )}

      {/* Character Stage with Live Greeting (Item 25 - below Tonight's Journal) */}
      <CharacterStage
        characterId={activeCharacterId}
        greetingText={greetingText}
      />


      {/* Unified Calendar Container (Section 6, 1) */}
      {activeChapter && (
        <UnifiedCalendarCard
          chapter={activeChapter}
          days={chapterDays}
          todayLogicalDate={todayStr}
          cycles={cycles}
          activeCycle={activeCycle}
          onSelectDate={handleHeatmapSelectDate}
          onStartCycle={handleStartCycle}
          onEndCycle={handleEndCycle}
          onUpdateCycle={handleUpdateCycle}
          onDeleteCycle={handleDeleteCycle}
          onSavePastCycle={handleSavePastCycle}
        />
      )}

      {/* Starter Pack Card */}
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

      {/* Chapter Details Modal (Items 22 & 23) */}
      {isChapterDetailsOpen && activeChapter && (
        <ChapterDetailsModal
          isOpen={isChapterDetailsOpen}
          chapter={activeChapter}
          chapterIndex={allChaptersCount}
          daysRemaining={progress.daysRemaining}
          isDevMode={isDevMode}
          onClose={() => setIsChapterDetailsOpen(false)}
          onSaveTitle={handleSaveChapterTitle}
          onSavePlannedEndDate={handleSavePlannedEndDate}
          onOpenReflections={() => setIsReflectionsOpen(true)}
          onCloseChapterDev={() => setIsChapterGateOpen(true)}
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

      {/* Chapter Closing Ceremony Gate (Enforced on scheduled closing date) */}
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
