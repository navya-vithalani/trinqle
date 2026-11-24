import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Smile,
  Star,
  Plus,
  Trash2,
  Droplets,
  FolderOpen,
  Pencil,
  Clock,
  BookOpen,
  Heart,
  Activity,
  FileText,
  Coffee,
  Award,
  Zap,
  Sun,
  Moon,
} from 'lucide-react'
import type {
  Section,
  Question,
  Part,
  Day,
  Answer,
  AnswerValue,
  EntryMode,
  Memorability,
  AnswerLink,
  Cycle,
} from '../../data/types'
import {
  FormRepository,
  DayRepository,
  CycleRepository,
} from '../../data/repositories'
import {
  checkCompleteness,
  checkOverlappingTimeRanges,
} from '../../core/formEngine'
import { getStickerById } from '../../core/stickers'
import { generateUUIDv7 } from '../../core/ids'
import { getLocalTimeZone } from '../../core/logicalDay'

import { YesNoWidget } from '../widgets/YesNoWidget'
import { ScaleWidget } from '../widgets/ScaleWidget'
import { NumberWidget } from '../widgets/NumberWidget'
import { TextWidget } from '../widgets/TextWidget'
import { TimeRangeWidget } from '../widgets/TimeRangeWidget'
import { LibraryWidget } from '../widgets/LibraryWidget'
import { StickerPickerModal } from '../dialogs/StickerPickerModal'

const QUESTION_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  Sparkles,
  Clock,
  BookOpen,
  Heart,
  Smile,
  Activity,
  FileText,
  Coffee,
  Award,
  Zap,
  Sun,
  Moon,
  Droplets,
}

interface NightlyFormModalProps {
  isOpen: boolean
  date: string // Logical date YYYY-MM-DD
  chapterId: string
  todayLogicalDate: string
  readOnly?: boolean
  onClose: () => void
  onSaved: () => void
}

export const NightlyFormModal: React.FC<NightlyFormModalProps> = ({
  isOpen,
  date,
  chapterId,
  todayLogicalDate,
  readOnly = false,
  onClose,
  onSaved,
}) => {
  const [step, setStep] = useState<'header' | 'questions'>('header')
  const [mode, setMode] = useState<EntryMode>('full')
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [expandedMore, setExpandedMore] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState<boolean>(readOnly)

  // Day header state
  const [title, setTitle] = useState('')
  const [oneliner, setOneliner] = useState('')
  const [stickerId, setStickerId] = useState<string | undefined>(undefined)
  const [overallRating, setOverallRating] = useState<number>(7.5)
  const [memorability, setMemorability] = useState<Memorability>(0)
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false)

  // Form schema state
  const [sections, setSections] = useState<Section[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [parts, setParts] = useState<Part[]>([])

  // Cycle state
  const [activeCycle, setActiveCycle] = useState<Cycle | null>(null)

  // Answers state: partId -> instance -> AnswerValue
  const [answersMap, setAnswersMap] = useState<Record<string, Record<number, AnswerValue>>>({})
  const [repeatingSessions, setRepeatingSessions] = useState<Record<string, number[]>>({}) // questionId -> instance numbers

  // Existing day check & change diff tracking
  const [existingDayRecord, setExistingDayRecord] = useState<Day | null>(null)
  const [initialSnapshotJson, setInitialSnapshotJson] = useState<string>('')

  const isBackfill = date < todayLogicalDate

  const formRepo = useMemo(() => new FormRepository(), [])
  const dayRepo = useMemo(() => new DayRepository(), [])
  const cycleRepo = useMemo(() => new CycleRepository(), [])

  useEffect(() => {
    setIsReadOnly(readOnly)
  }, [readOnly])

  // 1. Load schema and existing entry or draft
  useEffect(() => {
    if (!isOpen) return

    async function loadData() {
      const [allSecs, allQs, allParts, cycle] = await Promise.all([
        formRepo.getSections(date),
        formRepo.getQuestions(date),
        formRepo.getParts(date),
        cycleRepo.getActiveCycle(),
      ])

      const [y, m, d] = date.split('-').map(Number)
      const dayOfWeek = new Date(y, m - 1, d).getDay()

      const nightlySections = allSecs.filter((s) => {
        if (s.scope === 'chapterEnd') return false
        if (s.scope === 'weekly' && dayOfWeek !== 0) return false
        return true
      })

      const nightlySectionIds = new Set(nightlySections.map((s) => s.id))
      const nightlyQuestions = allQs.filter((q) => nightlySectionIds.has(q.sectionId))

      setSections(nightlySections)
      setQuestions(nightlyQuestions)
      setParts(allParts)
      setActiveCycle(cycle || null)

      const initSessions: Record<string, number[]> = {}
      nightlyQuestions.forEach((q) => {
        if (q.repeats) initSessions[q.id] = [0]
      })

      const existingDay = await dayRepo.getDay(date)
      if (existingDay) {
        setExistingDayRecord(existingDay)
        setTitle(existingDay.title || '')
        setOneliner(existingDay.oneliner || '')
        setStickerId(existingDay.stickerId)
        setOverallRating(existingDay.overallRating ?? 7.5)
        setMemorability(existingDay.memorability)
        setMode(existingDay.mode)
        setExpandedMore(existingDay.expandedMore)

        const existingAnswers = await dayRepo.getAnswersForDate(date)
        const loadedAnswers: Record<string, Record<number, AnswerValue>> = {}
        const loadedSessions: Record<string, Set<number>> = {}

        existingAnswers.forEach((a) => {
          if (!loadedAnswers[a.partId]) loadedAnswers[a.partId] = {}
          loadedAnswers[a.partId][a.instance] = a.value

          if (!loadedSessions[a.questionId]) loadedSessions[a.questionId] = new Set()
          loadedSessions[a.questionId].add(a.instance)
        })

        setAnswersMap(loadedAnswers)
        const sessionsRecord: Record<string, number[]> = {}
        Object.entries(loadedSessions).forEach(([qId, insts]) => {
          sessionsRecord[qId] = Array.from(insts).sort((a, b) => a - b)
        })
        setRepeatingSessions((prev) => ({ ...prev, ...sessionsRecord }))

        // Save baseline snapshot to detect actual edits
        setInitialSnapshotJson(
          JSON.stringify({
            answers: loadedAnswers,
            title: existingDay.title || '',
            oneliner: existingDay.oneliner || '',
            rating: existingDay.overallRating,
            memorability: existingDay.memorability,
          })
        )
      } else {
        setExistingDayRecord(null)
        setInitialSnapshotJson('')
        const draftKey = `trinqle_draft_${date}`
        const savedDraft = localStorage.getItem(draftKey)
        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft)
            setTitle(parsed.title || '')
            setOneliner(parsed.oneliner || '')
            setStickerId(parsed.stickerId)
            setOverallRating(parsed.overallRating ?? 7.5)
            setMemorability(parsed.memorability ?? 0)
            setMode(parsed.mode || 'full')
            setAnswersMap(parsed.answers || {})
            if (parsed.sessions) setRepeatingSessions(parsed.sessions)
          } catch {
            // invalid draft
          }
        } else {
          setAnswersMap({})
          setRepeatingSessions(initSessions)
          setStep('header')
        }
      }
    }

    loadData()
  }, [isOpen, date, formRepo, dayRepo, cycleRepo])

  // 2. Draft autosaving (only when not editing an existing record)
  useEffect(() => {
    if (!isOpen || existingDayRecord || isReadOnly) return
    const draftKey = `trinqle_draft_${date}`
    const draft = {
      title,
      oneliner,
      stickerId,
      overallRating,
      memorability,
      mode,
      answers: answersMap,
      sessions: repeatingSessions,
    }
    localStorage.setItem(draftKey, JSON.stringify(draft))
  }, [
    isOpen,
    existingDayRecord,
    isReadOnly,
    date,
    title,
    oneliner,
    stickerId,
    overallRating,
    memorability,
    mode,
    answersMap,
    repeatingSessions,
  ])

  if (!isOpen) return null

  // Flatten answers map into Answer[]
  const currentAnswerArray: Answer[] = []
  Object.entries(answersMap).forEach(([partId, instMap]) => {
    const part = parts.find((p) => p.id === partId)
    if (!part) return
    Object.entries(instMap).forEach(([instStr, val]) => {
      const inst = parseInt(instStr, 10)
      currentAnswerArray.push({
        id: generateUUIDv7(),
        date,
        questionId: part.questionId,
        partId,
        instance: inst,
        value: val,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })
  })

  // Completeness verification
  const completeness = checkCompleteness(
    { sections, questions, parts },
    date,
    mode,
    currentAnswerArray,
    Boolean(activeCycle)
  )

  const timeAnswers = currentAnswerArray
    .filter((a) => a.value && typeof a.value === 'object' && 'start' in a.value && 'end' in a.value)
    .map((a) => {
      const val = a.value as { start: string; end: string; crossesMidnight?: boolean }
      return {
        start: val.start,
        end: val.end,
        crossesMidnight: Boolean(val.crossesMidnight),
      }
    })
  const hasTimeOverlap = checkOverlappingTimeRanges(timeAnswers)

  const handleAnswerChange = (partId: string, instance: number, value: AnswerValue) => {
    if (isReadOnly) return
    setAnswersMap((prev) => ({
      ...prev,
      [partId]: {
        ...(prev[partId] || {}),
        [instance]: value,
      },
    }))
  }

  const addSession = (qId: string) => {
    if (isReadOnly) return
    setRepeatingSessions((prev) => {
      const existing = prev[qId] || [0]
      const nextInst = existing.length > 0 ? Math.max(...existing) + 1 : 0
      return { ...prev, [qId]: [...existing, nextInst] }
    })
  }

  const removeSession = (qId: string, instance: number) => {
    if (isReadOnly) return
    setRepeatingSessions((prev) => {
      const existing = prev[qId] || [0]
      if (existing.length <= 1) return prev
      return { ...prev, [qId]: existing.filter((i) => i !== instance) }
    })

    setAnswersMap((prev) => {
      const updated = { ...prev }
      const qParts = parts.filter((p) => p.questionId === qId)
      qParts.forEach((p) => {
        if (updated[p.id]) {
          const nextInstMap = { ...updated[p.id] }
          delete nextInstMap[instance]
          updated[p.id] = nextInstMap
        }
      })
      return updated
    })
  }

  const handleToggleCycle = async () => {
    if (activeCycle) {
      await cycleRepo.endCycle(activeCycle.id, todayLogicalDate)
      setActiveCycle(null)
    } else {
      const newC = await cycleRepo.startCycle(todayLogicalDate)
      setActiveCycle(newC)
    }
  }

  const handleSave = async () => {
    if (isReadOnly) {
      onClose()
      return
    }

    const now = Date.now()
    const finalAnswers: Answer[] = []
    const finalLinks: AnswerLink[] = []

    Object.entries(answersMap).forEach(([partId, instMap]) => {
      const part = parts.find((p) => p.id === partId)
      if (!part) return

      Object.entries(instMap).forEach(([instStr, val]) => {
        const inst = parseInt(instStr, 10)
        if (val === undefined || val === null) return

        const ansId = generateUUIDv7(now)
        finalAnswers.push({
          id: ansId,
          date,
          questionId: part.questionId,
          partId,
          instance: inst,
          value: val,
          createdAt: now,
          updatedAt: now,
        })

        if (part.kind === 'library' && Array.isArray(val)) {
          const libId = (part.config as any)?.libraryId || ''
          val.forEach((itemId) => {
            if (typeof itemId === 'string') {
              finalLinks.push({
                id: generateUUIDv7(now),
                answerId: ansId,
                date,
                libraryId: libId,
                itemId,
                createdAt: now,
                updatedAt: now,
              })
            }
          })
        }
      })
    })

    // Check if actual diffs occurred
    const currentSnapshotJson = JSON.stringify({
      answers: answersMap,
      title: title.trim(),
      oneliner: oneliner.trim(),
      rating: overallRating,
      memorability,
    })
    const hasActualChanges =
      Boolean(existingDayRecord) &&
      initialSnapshotJson !== '' &&
      initialSnapshotJson !== currentSnapshotJson

    const dayRecord: Day = {
      date,
      chapterId,
      title: title.trim() || undefined,
      oneliner: oneliner.trim() || undefined,
      stickerId,
      overallRating,
      memorability,
      mode,
      expandedMore,
      backfilled: isBackfill,
      filledAt: existingDayRecord ? existingDayRecord.filledAt : now,
      editedAt: hasActualChanges ? now : existingDayRecord?.editedAt,
      tz: getLocalTimeZone(),
    }

    await dayRepo.saveDay(dayRecord, finalAnswers, finalLinks)
    localStorage.removeItem(`trinqle_draft_${date}`)
    onSaved()
    onClose()
  }

  const currentSection = sections[currentSectionIndex]
  const currentSectionQuestions = questions.filter(
    (q) => q.sectionId === currentSection?.id
  )

  const quickQuestions = questions.filter((q) => {
    const qParts = parts.filter((p) => p.questionId === q.id)
    if (expandedMore) return true
    return qParts.some((p) => p.level === 'core')
  })

  const selectedSticker = stickerId ? getStickerById(stickerId) : undefined

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md max-h-[92vh] bg-[var(--color-surface)] rounded-[var(--radius-l)] border-2 border-[var(--color-line)] flex flex-col overflow-hidden shadow-2xl animate-scale-up">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--color-line)] bg-[var(--color-bg)]">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-[var(--color-ink)]">{date}</span>
            {isBackfill && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 font-bold border border-amber-400">
                Backfill
              </span>
            )}
            {/* Edited tag: ONLY show if previously modified and saved (Item 6) */}
            {existingDayRecord?.editedAt && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent2)]/20 text-[var(--color-ink)] font-bold border border-[var(--color-accent2)]">
                Edited
              </span>
            )}
            {isReadOnly && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-line)] text-[var(--color-ink-soft)] font-semibold">
                Browse Mode
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Small Edit button to switch from Browse into Edit Mode (Item 5) */}
            {isReadOnly && (
              <button
                type="button"
                onClick={() => setIsReadOnly(false)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] text-[11px] font-bold text-[var(--color-accent)] hover:border-[var(--color-accent)] active:scale-95 shadow-xs"
                title="Switch to Edit Mode"
              >
                <Pencil size={11} />
                <span>Edit</span>
              </button>
            )}

            {/* Direct Save Button in Header when in Edit Mode */}
            {!isReadOnly && existingDayRecord && (
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center space-x-1 px-3 py-1 rounded-full bg-[var(--color-accent)] text-white text-xs font-bold active:scale-95 shadow-xs"
                title="Save changes"
              >
                <Check size={12} />
                <span>Save</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] active:scale-95"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Step Navigation Tabs (Summary vs Questions) */}
        <div className="flex items-center border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-1.5 gap-2">
          <button
            type="button"
            onClick={() => setStep('header')}
            className={`py-1 px-3 rounded-full text-xs font-bold transition-all ${
              step === 'header'
                ? 'bg-[var(--color-bg)] text-[var(--color-accent)] border border-[var(--color-line)]'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            Day Summary
          </button>
          <button
            type="button"
            onClick={() => setStep('questions')}
            className={`py-1 px-3 rounded-full text-xs font-bold transition-all ${
              step === 'questions'
                ? 'bg-[var(--color-bg)] text-[var(--color-accent)] border border-[var(--color-line)]'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            Questions ({sections.length} sections)
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {step === 'header' ? (
            /* STEP 1: DAY HEADER */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-base font-bold text-[var(--color-ink)]">
                  {isReadOnly ? 'Day Summary' : 'How was your day?'}
                </h2>
                <p className="text-xs text-[var(--color-ink-soft)]">
                  {isReadOnly
                    ? 'Reviewing recorded journal entry for this date.'
                    : 'Fill the day header and pick your logging mode.'}
                </p>
              </div>

              {/* Title & One-liner Input */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-ink)] block">
                    Day Headline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rainy cafe morning & deep focus"
                    value={title}
                    disabled={isReadOnly}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] font-semibold text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-75"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-ink)] block">
                    One-liner summary
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Shipped Phase 4 and made matcha tea"
                    value={oneliner}
                    disabled={isReadOnly}
                    onChange={(e) => setOneliner(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-75"
                  />
                </div>
              </div>

              {/* Overall Rating (1 to 10 slider) */}
              <div className="p-3 bg-[var(--color-bg)] rounded-[var(--radius-m)] border border-[var(--color-line)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-ink)]">
                    Day Rating
                  </span>
                  <span className="text-xs font-bold text-[var(--color-accent)]">
                    {overallRating.toFixed(1)} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={overallRating}
                  disabled={isReadOnly}
                  onChange={(e) => setOverallRating(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)] bg-[var(--color-line)] disabled:opacity-75"
                />
              </div>

              {/* Sticker & Memorability Picker */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-ink)] block">
                    Daily Sticker
                  </label>
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => setIsStickerPickerOpen(true)}
                    className="w-full h-12 flex items-center justify-center rounded-[var(--radius-m)] border-2 border-dashed border-[var(--color-line)] bg-[var(--color-bg)] text-xs text-[var(--color-ink-soft)] hover:border-[var(--color-accent)] disabled:opacity-75"
                  >
                    {selectedSticker ? (
                      <span className="text-sm font-bold text-[var(--color-accent)]">
                        {selectedSticker.name}
                      </span>
                    ) : (
                      <div className="flex items-center space-x-1">
                        <Smile size={16} />
                        <span>Pick sticker</span>
                      </div>
                    )}
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-ink)] block">
                    Memorability
                  </label>
                  <div className="grid grid-cols-3 gap-1 h-12">
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setMemorability(0)}
                      className={`rounded-[var(--radius-m)] border text-[11px] font-semibold transition-all ${
                        memorability === 0
                          ? 'bg-[var(--color-accent)] text-white border-transparent'
                          : 'bg-[var(--color-bg)] border-[var(--color-line)] text-[var(--color-ink-soft)]'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setMemorability(2)}
                      className={`rounded-[var(--radius-m)] border text-[11px] font-semibold transition-all ${
                        memorability === 2
                          ? 'bg-indigo-600 text-white border-transparent'
                          : 'bg-[var(--color-bg)] border-[var(--color-line)] text-[var(--color-ink-soft)]'
                      }`}
                    >
                      Notable
                    </button>
                    <button
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setMemorability(3)}
                      className={`rounded-[var(--radius-m)] border text-[11px] font-semibold flex items-center justify-center transition-all ${
                        memorability === 3
                          ? 'bg-amber-500 text-white border-transparent'
                          : 'bg-[var(--color-bg)] border-[var(--color-line)] text-[var(--color-ink-soft)]'
                      }`}
                    >
                      <Star
                        size={16}
                        className={memorability === 3 ? 'fill-white text-white drop-shadow' : 'fill-current'}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Continue button */}
              <button
                type="button"
                onClick={() => setStep('questions')}
                className="w-full py-3 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-sm sticker-button"
              >
                Continue to questions
              </button>
            </div>
          ) : (
            /* STEP 2: QUESTIONS */
            <div className="space-y-4">
              {/* Full mode section heading and question icons (Item 10) */}
              {mode === 'full' && sections.length > 0 && (
                <div className="space-y-2 pb-2">
                  <div className="flex items-center space-x-1">
                    {sections.map((sec, idx) => (
                      <div
                        key={sec.id}
                        onClick={() => setCurrentSectionIndex(idx)}
                        className={`h-2 flex-1 rounded-full cursor-pointer transition-colors ${
                          idx === currentSectionIndex
                            ? 'bg-[var(--color-accent)]'
                            : idx < currentSectionIndex
                              ? 'bg-[var(--color-accent)]/50'
                              : 'bg-[var(--color-line)]'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Section Heading & Question Icon Navigation (Item 10) */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-2">
                      <FolderOpen size={16} className="text-[var(--color-accent)]" />
                      <h3 className="text-sm font-extrabold text-[var(--color-ink)]">
                        {currentSection?.name}
                      </h3>
                      {/* Question icon shortcuts for smooth scrolling (Item 10) */}
                      <div className="flex items-center space-x-1 pl-1">
                        {currentSectionQuestions.map((sq) => {
                          const IconCmp = (sq.icon && QUESTION_ICONS[sq.icon]) || Sparkles
                          return (
                            <button
                              key={sq.id}
                              type="button"
                              onClick={() => {
                                document
                                  .getElementById(`question-${sq.id}`)
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              }}
                              title={sq.label}
                              className="w-5 h-5 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-accent)] flex items-center justify-center hover:scale-110 active:scale-90 transition-transform"
                            >
                              <IconCmp size={10} />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--color-ink-soft)] px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)]">
                      {currentSectionIndex + 1} of {sections.length}
                    </span>
                  </div>
                </div>
              )}

              {/* Render Question Cards */}
              <div className="space-y-3">
                {(mode === 'full' ? currentSectionQuestions : quickQuestions).map((q) => {
                  const qParts = parts.filter((p) => p.questionId === q.id)
                  const gatePart = qParts.find((p) => p.gate)
                  const gateValue = answersMap[gatePart?.id || '']?.[0]
                  const isGateOn = gateValue === true

                  const sessions = q.repeats ? repeatingSessions[q.id] || [0] : [0]
                  const isCycleQuestion = q.special === 'cycle'

                  // Menstrual cycle section strict visibility (Section 6, 3B):
                  // Hide Period question if activeCycle is NOT active
                  if (isCycleQuestion && !activeCycle) {
                    return null
                  }

                  const hasOverlap =
                    hasTimeOverlap &&
                    parts.some((p) => p.questionId === q.id && p.kind === 'timerange')

                  // Special Period question when active
                  if (isCycleQuestion && activeCycle) {
                    return (
                      <div
                        id={`question-${q.id}`}
                        key={q.id}
                        className="sticker-card p-4 space-y-3 border-2 border-rose-300 bg-rose-50/40"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Droplets size={16} className="text-rose-600" />
                            <h4 className="font-bold text-sm text-rose-900">{q.label}</h4>
                          </div>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={handleToggleCycle}
                              className="py-1 px-3 rounded-full bg-rose-200 text-rose-900 border border-rose-300 font-bold text-[11px] active:scale-95"
                            >
                              End Period
                            </button>
                          )}
                        </div>

                        {/* Daily period symptoms & flow */}
                        <div className="space-y-2 pt-2 border-t border-rose-200">
                          {qParts.map((p) => {
                            const val = answersMap[p.id]?.[0]
                            return (
                              <div key={p.id}>
                                {p.kind === 'scale' && (
                                  <ScaleWidget
                                    label={p.label}
                                    value={val as number}
                                    disabled={isReadOnly}
                                    config={p.config as any}
                                    onChange={(v) => handleAnswerChange(p.id, 0, v)}
                                  />
                                )}
                                {p.kind === 'library' && (
                                  <LibraryWidget
                                    label={p.label}
                                    value={val as any}
                                    disabled={isReadOnly}
                                    config={p.config as any}
                                    onChange={(v) => handleAnswerChange(p.id, 0, v)}
                                  />
                                )}
                                {p.kind === 'text' && (
                                  <TextWidget
                                    label={p.label}
                                    value={(val as string) ?? ''}
                                    disabled={isReadOnly}
                                    onChange={(v) => handleAnswerChange(p.id, 0, v)}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }

                  const hasCorePart = qParts.some((p) => p.level === 'core')
                  const libraryParts = qParts.filter(
                    (p) => !p.gate && p.kind === 'library'
                  )
                  const otherParts = qParts.filter(
                    (p) => !p.gate && p.kind !== 'library'
                  )
                  const hasMultipleLibraryParts = libraryParts.length > 1

                  return (
                    <div
                      id={`question-${q.id}`}
                      key={q.id}
                      className={`sticker-card p-4 space-y-3 ${
                        hasCorePart ? 'border-l-4 border-l-[var(--color-accent)]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-sm text-[var(--color-ink)]">
                            {q.label}
                          </h4>
                          {hasCorePart && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[var(--color-accent)]/15 text-[var(--color-accent)] tracking-wider uppercase">
                              Core
                            </span>
                          )}
                        </div>

                        {/* Large readable Add Session Button (Item 9) */}
                        {q.repeats && (!gatePart || isGateOn) && !isReadOnly && (
                          <button
                            type="button"
                            onClick={() => addSession(q.id)}
                            className="flex items-center space-x-1 px-3 py-1 rounded-full bg-[var(--color-surface)] border-2 border-[var(--color-line)] text-xs font-bold text-[var(--color-accent)] hover:border-[var(--color-accent)] active:scale-95 shadow-xs"
                          >
                            <Plus size={12} />
                            <span>Add Session</span>
                          </button>
                        )}
                      </div>

                      {hasOverlap && (
                        <div className="flex items-center space-x-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                          <AlertTriangle size={14} />
                          <span>Note: Time ranges for this question overlap.</span>
                        </div>
                      )}

                      {/* Render Gate Part if present */}
                      {gatePart && (
                        <YesNoWidget
                          label={gatePart.label}
                          value={typeof gateValue === 'boolean' ? gateValue : undefined}
                          required={gatePart.level === 'core'}
                          disabled={isReadOnly}
                          onChange={(val) => handleAnswerChange(gatePart.id, 0, val ?? false)}
                        />
                      )}

                      {/* Horizontally Swipeable Sessions (Items 7 & 8) */}
                      {(!gatePart || isGateOn) && (
                        <div className="flex flex-row overflow-x-auto snap-x snap-mandatory gap-2.5 pb-2 scrollbar-thin">
                          {sessions.map((instance, sIdx) => (
                            <div
                              key={instance}
                              className={
                                q.repeats && sessions.length > 1
                                  ? 'min-w-[85%] sm:min-w-[90%] snap-center shrink-0 p-3 bg-[var(--color-bg)]/60 rounded-[var(--radius-m)] border border-[var(--color-line)] space-y-2 shadow-xs'
                                  : 'w-full space-y-2'
                              }
                            >
                              {/* Session Top Bar: Plain numeral in top-left (Item 8) */}
                              {q.repeats && sessions.length > 1 && (
                                <div className="flex items-center justify-between pb-1 border-b border-[var(--color-line)]">
                                  <span className="w-5 h-5 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] text-[11px] font-extrabold text-[var(--color-accent)] flex items-center justify-center">
                                    {sIdx + 1}
                                  </span>
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => removeSession(q.id, instance)}
                                      className="text-red-400 hover:text-red-600 p-0.5 active:scale-90"
                                      title="Remove session"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Two-Column Split Layout for Multiple Library Parts (Item 11) */}
                              {hasMultipleLibraryParts && (
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  {libraryParts.map((p) => {
                                    const val = answersMap[p.id]?.[instance]
                                    return (
                                      <div key={p.id}>
                                        <LibraryWidget
                                          label={p.label}
                                          value={val as any}
                                          disabled={isReadOnly}
                                          config={p.config as any}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      </div>
                                    )
                                  })}
                                </div>
                              )}

                              {/* Other Parts (or single library part) */}
                              {(hasMultipleLibraryParts ? otherParts : qParts.filter((p) => !p.gate))
                                .filter((p) =>
                                  mode === 'quick' && !expandedMore ? p.level === 'core' : true
                                )
                                .map((p) => {
                                  const val = answersMap[p.id]?.[instance]
                                  const isMissing = completeness.missingPartIds.includes(p.id)
                                  const isCore = p.level === 'core'

                                  return (
                                    <div
                                      key={p.id}
                                      className={`space-y-1 ${
                                        isMissing
                                          ? 'rounded-lg p-2 bg-red-50 border border-red-300'
                                          : ''
                                      }`}
                                    >
                                      {p.kind === 'yesno' && (
                                        <YesNoWidget
                                          label={p.label}
                                          value={typeof val === 'boolean' ? val : undefined}
                                          required={isCore}
                                          disabled={isReadOnly}
                                          onChange={(v) =>
                                            handleAnswerChange(p.id, instance, v ?? false)
                                          }
                                        />
                                      )}
                                      {p.kind === 'scale' && (
                                        <ScaleWidget
                                          label={p.label}
                                          value={val as number}
                                          required={isCore}
                                          disabled={isReadOnly}
                                          config={p.config as any}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      )}
                                      {p.kind === 'number' && (
                                        <NumberWidget
                                          label={p.label}
                                          value={val as number}
                                          disabled={isReadOnly}
                                          config={p.config as any}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      )}
                                      {p.kind === 'text' && (
                                        <TextWidget
                                          label={p.label}
                                          value={(val as string) ?? ''}
                                          disabled={isReadOnly}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      )}
                                      {p.kind === 'timerange' && (
                                        <TimeRangeWidget
                                          label={p.label}
                                          value={val as any}
                                          date={date}
                                          disabled={isReadOnly}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      )}
                                      {!hasMultipleLibraryParts && p.kind === 'library' && (
                                        <LibraryWidget
                                          label={p.label}
                                          value={val as any}
                                          disabled={isReadOnly}
                                          config={p.config as any}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Quick Mode Expander */}
              {mode === 'quick' && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setExpandedMore(!expandedMore)}
                    className="text-xs font-semibold text-[var(--color-accent)] hover:underline inline-flex items-center space-x-1"
                  >
                    <Sparkles size={13} />
                    <span>{expandedMore ? 'Show fewer questions' : 'More questions (show extras)'}</span>
                  </button>
                </div>
              )}

              {/* Forgot to log period start quick-action chip (Section 6, 3B) */}
              {!activeCycle && !isReadOnly && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const newC = await cycleRepo.startCycle(todayLogicalDate)
                      setActiveCycle(newC)
                    }}
                    className="flex items-center space-x-1 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold active:scale-95 shadow-xs"
                  >
                    <Droplets size={12} className="text-rose-500" />
                    <span>Forgot to log period start?</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-3 border-t-2 border-[var(--color-line)] bg-[var(--color-surface)]">
          {step === 'questions' ? (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  if (mode === 'full' && currentSectionIndex > 0) {
                    setCurrentSectionIndex(currentSectionIndex - 1)
                  } else {
                    setStep('header')
                  }
                }}
                className="py-2.5 px-4 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-surface)] font-semibold text-xs text-[var(--color-ink)] flex items-center space-x-1 active:scale-95"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              {mode === 'full' && currentSectionIndex < sections.length - 1 ? (
                <>
                  {existingDayRecord && !isReadOnly && (
                    <button
                      type="button"
                      onClick={handleSave}
                      className="py-2.5 px-3 rounded-[var(--radius-pill)] border-2 border-[var(--color-accent)] text-[var(--color-accent)] font-bold text-xs bg-[var(--color-surface)] active:scale-95"
                    >
                      Save
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCurrentSectionIndex(currentSectionIndex + 1)}
                    className="flex-1 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-semibold text-xs flex items-center justify-center space-x-1 sticker-button"
                  >
                    <span>Next section</span>
                    <ChevronRight size={16} />
                  </button>
                </>
              ) : isReadOnly ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-ink)] text-white font-bold text-xs sticker-button active:scale-95"
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!completeness.complete}
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-xs sticker-button disabled:opacity-50 disabled:shadow-none"
                >
                  {completeness.complete
                    ? existingDayRecord
                      ? 'Save changes'
                      : 'Save tonight'
                    : 'Answer required core questions'}
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              {existingDayRecord && !isReadOnly && (
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-xs sticker-button active:scale-95"
                >
                  Save changes
                </button>
              )}
              <button
                type="button"
                onClick={() => setStep('questions')}
                className="flex-1 py-2.5 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-surface)] font-semibold text-xs text-[var(--color-ink)] flex items-center justify-center space-x-1 active:scale-95"
              >
                <span>Continue to questions</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sticker Picker Modal */}
      <StickerPickerModal
        isOpen={isStickerPickerOpen}
        selectedStickerId={stickerId}
        onClose={() => setIsStickerPickerOpen(false)}
        onSelectSticker={(id) => setStickerId(id)}
      />
    </div>
  )
}
