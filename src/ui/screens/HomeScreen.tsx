import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  FileText,
  Clock,
  AlertCircle,
  Eye,
  ShieldAlert,
  Sliders,
  X,
  BellRing,
  BookOpen,
  ChevronRight,
  Pencil,
} from 'lucide-react'
import {
  isPushSupported,
  getNotificationPermission,
  subscribeDeviceToPush,
  DEFAULT_VAPID_PUBLIC_KEY,
} from '../../core/notifications/client'
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
import { getStickerById, loadCustomStickerItems, type StickerItem } from '../../core/stickers'
import {
  logicalDate,
  isWindowOpen,
  addDays,
  DEFAULT_WINDOW,
} from '../../core/logicalDay'
import { formatTimeByPreference, type AppSettings } from '../../core/settings'
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
  appSettings?: AppSettings
  onNavigateToDay?: (date: string) => void
  onNavigateToProfileBrowse?: (date: string) => void
  onNavigateToInsights?: () => void
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  appSettings,
  onNavigateToDay,
  onNavigateToProfileBrowse,
  onNavigateToInsights,
}) => {
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null)
  const [allChaptersCount, setAllChaptersCount] = useState(1)
  const [todayDay, setTodayDay] = useState<Day | null>(null)
  const [chapterDays, setChapterDays] = useState<Day[]>([])
  const [missingDays, setMissingDays] = useState<string[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [activeCycle, setActiveCycle] = useState<Cycle | undefined>(undefined)
  const [hasFormSections, setHasFormSections] = useState(true)
  const [reflectionProgress, setReflectionProgress] = useState<{ answered: number; total: number }>({
    answered: 0,
    total: 0,
  })

  // Pre-close countdown & Sunday insights prompt
  const [isPreCloseDismissed, setIsPreCloseDismissed] = useState(false)
  const [isSundayPromptDismissed, setIsSundayPromptDismissed] = useState(false)
  const [showFirstNightPrompt, setShowFirstNightPrompt] = useState(false)

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
  const [loggingStreak, setLoggingStreak] = useState(0)
  const [activeCharacterId, setActiveCharacterId] = useState<string>('white-cat')
  const [customStickers, setCustomStickers] = useState<StickerItem[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const chapterRepo = new ChapterRepository()
  const dayRepo = new DayRepository()
  const cycleRepo = new CycleRepository()
  const formRepo = new FormRepository()

  const startHour = appSettings?.windowStartHour ?? DEFAULT_WINDOW.startHour
  const endHour = appSettings?.windowEndHour ?? DEFAULT_WINDOW.endHour
  const weekStart = appSettings?.weekStart ?? 'Monday'
  const timeFormat = appSettings?.timeFormat ?? '12h'
  const windowStartStr = appSettings?.formWindowStart ?? '21:00'

  const now = new Date()
  const todayStr = logicalDate(now, undefined, endHour)
  const windowOpen = isWindowOpen(now, startHour, endHour)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const checkFirstNightPrompt = () => {
    if (typeof window === 'undefined') return
    try {
      const alreadyShown = localStorage.getItem('trinqle_first_night_prompt_shown')
      if (alreadyShown === 'true') return
      if (!isPushSupported() || getNotificationPermission() !== 'default') return
      setShowFirstNightPrompt(true)
    } catch {
      // Ignore storage errors
    }
  }

  const loadState = async () => {
    setActiveCharacterId(loadCharacterPreference())

    // 1. Chapters
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

    if (isChapterHardLocked(chapter, todayStr)) {
      setIsChapterGateOpen(true)
    }

    // 2. Form existence & reflections progress
    const [allSecs, allQs, allParts, existingChapAnswers, loadedCustomStickers] = await Promise.all([
      formRepo.getSections(todayStr),
      formRepo.getQuestions(todayStr),
      formRepo.getParts(todayStr),
      chapterRepo.getChapterAnswers(chapter.id),
      loadCustomStickerItems(),
    ])
    setCustomStickers(loadedCustomStickers)

    setHasFormSections(allSecs.length > 0)

    const chapEndSecIds = new Set(allSecs.filter((s) => s.scope === 'chapterEnd').map((s) => s.id))
    const chapEndQs = allQs.filter((q) => chapEndSecIds.has(q.sectionId) || q.schedule?.chapterEnd)
    const chapEndQIds = new Set(chapEndQs.map((q) => q.id))
    const chapEndParts = allParts.filter((p) => chapEndQIds.has(p.questionId))
    const totalPrompts = chapEndParts.length + (chapter.customPrompts?.length || 0)
    const validPromptIds = new Set([
      ...chapEndParts.map((p) => p.id),
      ...(chapter.customPrompts || []).map((cp) => cp.id),
    ])
    const answeredPrompts = existingChapAnswers.filter(
      (ca) =>
        validPromptIds.has(ca.promptId) &&
        ca.value !== undefined &&
        ca.value !== null &&
        ca.value !== ''
    ).length
    setReflectionProgress({ answered: answeredPrompts, total: totalPrompts })

    // 3. Today & chapter days
    const entry = await dayRepo.getDay(todayStr)
    setTodayDay(entry && !entry.deletedAt ? entry : null)

    const allDaysInChapter = await dayRepo.getDaysInDateRange(
      chapter.startDate,
      chapter.plannedEndDate
    )
    setChapterDays(allDaysInChapter)

    // 4. Missing past days for backfill banner (last 3 days)
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

    // 5. Cycles
    const allCycles = await cycleRepo.getAllCycles()
    setCycles(allCycles)
    const currentActiveCycle = await cycleRepo.getActiveCycle()
    setActiveCycle(currentActiveCycle)

    // 6. Greetings Engine
    try {
      const { context, dateStr } = await buildGreetingContext(now)
      setLoggingStreak(context.loggingStreak)
      const greeting = evaluateGreetings(context, dateStr)
      setGreetingText(greeting.text)
    } catch {
      setGreetingText('Welcome back.')
    }
  }

  useEffect(() => {
    loadState()
  }, [appSettings?.windowEndHour, appSettings?.windowStartHour])

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
    showToast('Cycle record removed')
    loadState()
  }

  const handleSavePastCycle = async (startDate: string, endDate: string) => {
    await cycleRepo.createCompletedCycle(startDate, endDate)
    showToast('Past cycle backfilled successfully')
    loadState()
  }

  const handleHeatmapSelectDate = (targetDate: string) => {
    const canBackfillDate =
      targetDate < todayStr && targetDate >= addDays(todayStr, -3)
    const dayExists = chapterDays.some((d) => d.date === targetDate)
    if (dayExists) {
      if (onNavigateToDay) onNavigateToDay(targetDate)
      else if (onNavigateToProfileBrowse) onNavigateToProfileBrowse(targetDate)
      else openFormForDate(targetDate)
    } else if (canBackfillDate || targetDate === todayStr) {
      openFormForDate(targetDate)
    } else if (onNavigateToDay) {
      onNavigateToDay(targetDate)
    }
  }

  const progress = activeChapter
    ? getChapterProgress(activeChapter, todayStr)
    : { currentDayNumber: 1, totalDays: 28, daysRemaining: 27 }

  const isFinalTwoDays = progress.daysRemaining <= 2
  const chapterWorkingName =
    activeChapter?.title || `Chapter ${allChaptersCount}`

  const todaySticker = todayDay?.stickerId
    ? getStickerById(todayDay.stickerId, customStickers)
    : undefined

  const ambientMood: 'normal' | 'sleepy' | 'excited' =
    todayDay?.memorability === 3 || loggingStreak >= 7
      ? 'excited'
      : !windowOpen || now.getHours() >= 1 && now.getHours() < 6
        ? 'sleepy'
        : 'normal'

  return (
    <div className="space-y-4 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-ink)] text-[var(--color-surface)] text-xs font-semibold py-1.5 px-4 rounded-full shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Chapter Banner */}
      {activeChapter && (
        <>
          {isFinalTwoDays && !isPreCloseDismissed ? (
            <div className="p-4 bg-[var(--color-warn)] text-white rounded-[var(--radius-m)] shadow-md border-2 border-[var(--color-warn)] space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <ShieldAlert size={20} className="text-white shrink-0" />
                  <div>
                    <h4 className="font-extrabold text-sm leading-tight">
                      {chapterWorkingName} wraps up {progress.daysRemaining === 0 ? 'today' : `in ${progress.daysRemaining} day${progress.daysRemaining === 1 ? '' : 's'}`}!
                    </h4>
                    <p className="text-xs text-white/90 mt-0.5">
                      Prepare your closing ceremony: finish reflections, pick up to 10 photos, and review your title.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsPreCloseDismissed(true)
                  }}
                  className="p-1 hover:bg-black/10 rounded text-white/80 hover:text-white transition-colors shrink-0"
                  title="Dismiss countdown card"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/30">
                <button
                  type="button"
                  onClick={() => setIsReflectionsOpen(true)}
                  className="px-3 py-1.5 bg-[var(--color-surface)] text-[var(--color-ink)] rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Sparkles size={13} className="text-[var(--color-warn)]" />
                  <span>Finish reflections</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsChapterDetailsOpen(true)}
                  className="px-3 py-1.5 bg-black/20 hover:bg-black/30 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Sliders size={13} />
                  <span>Review chapter details</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsChapterDetailsOpen(true)}
              className={`cursor-pointer transition-all select-none active:scale-[0.99] px-4 py-2.5 rounded-[var(--radius-m)] border-2 shadow-xs hover:border-[var(--color-accent)] ${
                isFinalTwoDays
                  ? 'bg-[var(--color-warn)]/15 border-[var(--color-warn)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-line)]'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider flex items-center gap-1">
                  {isFinalTwoDays && <ShieldAlert size={12} className="text-[var(--color-warn)]" />}
                  Day {progress.currentDayNumber}/{progress.totalDays}
                </span>

                <span className="font-extrabold text-sm text-[var(--color-ink)] text-center px-2 truncate">
                  {chapterWorkingName}
                </span>

                <span
                  className={`text-xs font-bold shrink-0 ${
                    isFinalTwoDays ? 'text-[var(--color-warn)]' : 'text-[var(--color-accent)]'
                  }`}
                >
                  {progress.daysRemaining} days to go
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Sunday Insights Prompt Banner */}
      {now.getDay() === 0 && !isSundayPromptDismissed && (
        <div className="p-3 bg-[var(--color-accent3)]/10 border-2 border-[var(--color-accent3)]/40 rounded-[var(--radius-m)] flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent3)]/20 flex items-center justify-center text-[var(--color-accent3)] shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--color-ink)]">Sunday Insights Ready</h4>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                Analyze correlations, streak records, and weekly patterns.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateToInsights?.()}
              className="px-2.5 py-1 bg-[var(--color-accent3)] text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
            >
              Generate
            </button>
            <button
              type="button"
              onClick={() => setIsSundayPromptDismissed(true)}
              className="p-1 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
              title="Dismiss prompt"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Empty State: No Form Configured Yet */}
      {!hasFormSections && (
        <div className="sticker-card p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-[var(--color-ink)]">Set up your form</h2>
            <p className="text-xs text-[var(--color-ink-soft)] mt-1">
              Build your personalized nightly journal or import a form pack JSON.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-semibold text-sm sticker-button"
            >
              <FileText size={16} />
              <span>Import a form</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFormEditorOpen(true)}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-[var(--color-ink)] font-medium text-sm active:scale-95"
            >
              <Sliders size={16} className="text-[var(--color-accent)]" />
              <span>Build one</span>
            </button>

            <button
              type="button"
              onClick={handleUseStarterPack}
              className="w-full text-center py-1.5 text-xs font-semibold text-[var(--color-accent)] hover:underline"
            >
              Use sample starter pack
            </button>
          </div>
        </div>
      )}

      {/* Tonight's Form Card */}
      {hasFormSections && (
        <div className="sticker-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock size={18} className="text-[var(--color-accent)]" />
              <h3 className="font-semibold text-sm text-[var(--color-ink)]">Tonight's journal</h3>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border ${
                todayDay
                  ? 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/40 font-bold'
                  : windowOpen
                    ? 'bg-[var(--color-accent)] text-white border-transparent font-bold'
                    : 'bg-[var(--color-bg)] text-[var(--color-ink-soft)] border-[var(--color-line)]'
              }`}
            >
              {todayDay
                ? 'Completed'
                : windowOpen
                  ? 'Open now'
                  : `Opens at ${formatTimeByPreference(windowStartStr, timeFormat)}`}
            </span>
          </div>

          {todayDay ? (
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)]">
              <div className="flex items-center space-x-2.5 min-w-0">
                {todaySticker ? (
                  <img
                    src={todaySticker.url}
                    alt={todaySticker.name}
                    className="w-8 h-8 object-contain shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)] shrink-0">
                    <Sparkles size={15} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--color-ink)] truncate">
                    {todayDay.title || todayDay.oneliner || 'Tonight logged'}
                  </p>
                  <div className="flex items-center space-x-1.5 text-[10px] text-[var(--color-ink-soft)]">
                    <span className="capitalize font-semibold">{todayDay.mode} mode</span>
                    {todayDay.overallRating !== undefined && (
                      <span>· {todayDay.overallRating.toFixed(1)}/10</span>
                    )}
                    {todayDay.editedAt && <span>· Edited</span>}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openFormForDate(todayStr)}
                className="px-3 py-1.5 rounded-[var(--radius-pill)] bg-[var(--color-surface)] border border-[var(--color-line)] text-xs font-bold text-[var(--color-accent)] hover:border-[var(--color-accent)] flex items-center space-x-1 shrink-0 active:scale-95"
              >
                <Pencil size={12} />
                <span>Edit</span>
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--color-ink-soft)]">
                {windowOpen
                  ? 'Form is open for tonight!'
                  : `Window opens at ${formatTimeByPreference(windowStartStr, timeFormat)}.`}
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
                    <span>Preview form</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Backfill Banner */}
      {hasFormSections && missingDays.length > 0 && (
        <div className="p-3 bg-[var(--color-warn)]/15 rounded-[var(--radius-m)] border border-[var(--color-warn)]/50 flex items-center justify-between text-xs text-[var(--color-ink)] shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} className="text-[var(--color-warn)] shrink-0" />
            <span>
              <strong>{missingDays[0]}</strong> was not filled.
            </span>
          </div>
          <button
            type="button"
            onClick={() => openFormForDate(missingDays[0])}
            className="px-3 py-1 rounded-full bg-[var(--color-warn)] text-white font-bold text-[11px] shrink-0 active:scale-95"
          >
            Backfill
          </button>
        </div>
      )}

      {/* Character Stage with Live Greeting */}
      <CharacterStage
        characterId={activeCharacterId}
        greetingText={greetingText}
        ambientMood={ambientMood}
      />

      {/* Unified Calendar Container */}
      {activeChapter && (
        <UnifiedCalendarCard
          chapter={activeChapter}
          days={chapterDays}
          todayLogicalDate={todayStr}
          weekStart={weekStart}
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

      {/* Compact Reflections Row (PRD 5.2) */}
      {activeChapter && (
        <button
          type="button"
          onClick={() => setIsReflectionsOpen(true)}
          className="w-full sticker-card p-3.5 flex items-center justify-between text-left hover:border-[var(--color-accent)] transition-colors active:scale-[0.99]"
        >
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/15 flex items-center justify-center text-[var(--color-accent)]">
              <BookOpen size={15} />
            </div>
            <div>
              <span className="text-xs font-bold text-[var(--color-ink)] block">
                Chapter Reflections
              </span>
              <span className="text-[11px] text-[var(--color-ink-soft)]">
                {reflectionProgress.total > 0
                  ? `${reflectionProgress.answered} of ${reflectionProgress.total} answered · Open all chapter`
                  : 'Add chapter thoughts and custom prompts'}
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-[var(--color-ink-soft)] shrink-0" />
        </button>
      )}

      {/* Nightly Form Modal */}
      {isModalOpen && (
        <NightlyFormModal
          isOpen={isModalOpen}
          date={modalDate}
          chapterId={activeChapter?.id || ''}
          todayLogicalDate={todayStr}
          timeFormat={timeFormat}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            showToast('Night saved successfully!')
            loadState()
            checkFirstNightPrompt()
          }}
        />
      )}

      {/* Chapter Details Modal */}
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
            showToast('Imported successfully!')
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

      {/* First-Night Push Notification Prompt */}
      {showFirstNightPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-[var(--radius-l)] border-2 border-[var(--color-line)] p-5 space-y-4 shadow-xl">
            <div className="flex items-center space-x-2 text-[var(--color-accent)] font-bold text-sm">
              <BellRing size={20} />
              <span>Enable daily reminders?</span>
            </div>
            <p className="text-xs text-[var(--color-ink-soft)] leading-relaxed">
              Piqsie can send a gentle nudge at {formatTimeByPreference(windowStartStr, timeFormat)} when tonight's journal is open. Zero journal content ever leaves your device.
            </p>
            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('trinqle_first_night_prompt_shown', 'true')
                  } catch {
                    // Ignore
                  }
                  setShowFirstNightPrompt(false)
                }}
                className="flex-1 py-2 rounded-[var(--radius-pill)] border border-[var(--color-line)] bg-[var(--color-bg)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-line)]/50 active:scale-95"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    localStorage.setItem('trinqle_first_night_prompt_shown', 'true')
                  } catch {
                    // Ignore
                  }
                  setShowFirstNightPrompt(false)
                  const res = await subscribeDeviceToPush(DEFAULT_VAPID_PUBLIC_KEY)
                  if (res.success) {
                    showToast(`Daily reminder set for ${formatTimeByPreference(windowStartStr, timeFormat)}`)
                  } else {
                    showToast(res.error || 'Notifications could not be enabled')
                  }
                }}
                className="flex-1 py-2 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white text-xs font-bold shadow-xs hover:opacity-90 active:scale-95"
              >
                Enable reminders
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
