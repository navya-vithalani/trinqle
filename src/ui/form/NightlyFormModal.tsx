import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Smile,
  Star,
  Plus,
  Trash2,
  Droplet,
  FolderOpen,
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

interface NightlyFormModalProps {
  isOpen: boolean
  date: string // Logical date YYYY-MM-DD
  chapterId: string
  todayLogicalDate: string
  onClose: () => void
  onSaved: () => void
}

export const NightlyFormModal: React.FC<NightlyFormModalProps> = ({
  isOpen,
  date,
  chapterId,
  todayLogicalDate,
  onClose,
  onSaved,
}) => {
  const [step, setStep] = useState<'header' | 'questions'>('header')
  // Default to full mode per request
  const [mode, setMode] = useState<EntryMode>('full')
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const [expandedMore, setExpandedMore] = useState(false)

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

  // Existing day check (editing mode)
  const [isEditing, setIsEditing] = useState(false)

  const isBackfill = date < todayLogicalDate

  const formRepo = useMemo(() => new FormRepository(), [])
  const dayRepo = useMemo(() => new DayRepository(), [])
  const cycleRepo = useMemo(() => new CycleRepository(), [])

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

      // Filter sections:
      // - chapterEnd sections are strictly for chapter wrap-up and NEVER in nightly form!
      // - weekly section is only included if today is Sunday (weekday 0)
      const [y, m, d] = date.split('-').map(Number)
      const dayOfWeek = new Date(y, m - 1, d).getDay()

      const nightlySections = allSecs.filter((s) => {
        if (s.scope === 'chapterEnd') return false
        if (s.scope === 'weekly' && dayOfWeek !== 0) return false
        return true
      })

      // Filter questions belonging to active nightly sections
      const nightlySectionIds = new Set(nightlySections.map((s) => s.id))
      const nightlyQuestions = allQs.filter((q) => nightlySectionIds.has(q.sectionId))

      setSections(nightlySections)
      setQuestions(nightlyQuestions)
      setParts(allParts)
      setActiveCycle(cycle || null)

      // Initialize default session 0 for repeating questions
      const initSessions: Record<string, number[]> = {}
      nightlyQuestions.forEach((q) => {
        if (q.repeats) initSessions[q.id] = [0]
      })

      // Check if existing saved day exists
      const existingDay = await dayRepo.getDay(date)
      if (existingDay) {
        setIsEditing(true)
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
      } else {
        setIsEditing(false)
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

  // 2. Draft autosaving
  useEffect(() => {
    if (!isOpen || isEditing) return
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
  }, [isOpen, isEditing, date, title, oneliner, stickerId, overallRating, memorability, mode, answersMap, repeatingSessions])

  if (!isOpen) return null

  // Flatten answers map into Answer[]
  const currentAnswerArray: Answer[] = []
  Object.entries(answersMap).forEach(([partId, instMap]) => {
    const part = parts.find((p) => p.id === partId)
    if (!part) return
    Object.entries(instMap).forEach(([instStr, val]) => {
      const instance = parseInt(instStr, 10)
      currentAnswerArray.push({
        id: `ans_${partId}_${instance}`,
        date,
        questionId: part.questionId,
        partId,
        instance,
        value: val,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })
  })

  // Completeness check
  const snapshot = { sections, questions, parts }
  const completeness = checkCompleteness(
    snapshot,
    date,
    mode,
    currentAnswerArray,
    !!activeCycle
  )

  const handleAnswerChange = (partId: string, instance: number, value: AnswerValue) => {
    setAnswersMap((prev) => {
      const partAnswers = prev[partId] ? { ...prev[partId] } : {}
      partAnswers[instance] = value
      return { ...prev, [partId]: partAnswers }
    })
  }

  const addSession = (questionId: string) => {
    setRepeatingSessions((prev) => {
      const list = prev[questionId] || [0]
      const nextInst = list.length > 0 ? Math.max(...list) + 1 : 0
      return { ...prev, [questionId]: [...list, nextInst] }
    })
  }

  const removeSession = (questionId: string, instance: number) => {
    setRepeatingSessions((prev) => {
      const list = (prev[questionId] || [0]).filter((i) => i !== instance)
      return { ...prev, [questionId]: list.length > 0 ? list : [0] }
    })

    const qParts = parts.filter((p) => p.questionId === questionId)
    setAnswersMap((prev) => {
      const nextMap = { ...prev }
      qParts.forEach((p) => {
        if (nextMap[p.id]) {
          const instMap = { ...nextMap[p.id] }
          delete instMap[instance]
          nextMap[p.id] = instMap
        }
      })
      return nextMap
    })
  }

  const handleToggleCycle = async () => {
    if (activeCycle) {
      // End period
      await cycleRepo.endCycle(activeCycle.id, date)
      setActiveCycle(null)
    } else {
      // Start period
      const newCycle = await cycleRepo.startCycle(date)
      setActiveCycle(newCycle)
    }
  }

  const handleSave = async () => {
    if (!completeness.complete) return

    const finalAnswers: Answer[] = []
    const finalLinks: AnswerLink[] = []
    const now = Date.now()

    Object.entries(answersMap).forEach(([partId, instMap]) => {
      const part = parts.find((p) => p.id === partId)
      if (!part) return

      Object.entries(instMap).forEach(([instStr, val]) => {
        const instance = parseInt(instStr, 10)
        if (val === undefined || val === null || val === '') return

        const answerId = generateUUIDv7(now)
        finalAnswers.push({
          id: answerId,
          date,
          questionId: part.questionId,
          partId,
          instance,
          value: val,
          createdAt: now,
          updatedAt: now,
        })

        if (part.kind === 'library' && (typeof val === 'string' || Array.isArray(val))) {
          const config = part.config as { libraryId?: string }
          const libId = config.libraryId || ''
          const itemNames = Array.isArray(val) ? val : [val]

          itemNames.forEach((name) => {
            finalLinks.push({
              id: generateUUIDv7(now),
              answerId,
              date,
              libraryId: libId,
              itemId: name,
              createdAt: now,
              updatedAt: now,
            })
          })
        }
      })
    })

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
      filledAt: now,
      editedAt: isEditing ? now : undefined,
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
      {/* 4-sided bordered floating modal sheet */}
      <div className="w-full max-w-md max-h-[92vh] bg-(--color-surface) rounded-(--radius-l) border-2 border-(--color-line) flex flex-col overflow-hidden shadow-2xl animate-scale-up">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-(--color-line) bg-(--color-bg)">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-(--color-ink)">
              {date}
            </span>
            {isBackfill && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-(--color-warn)/20 text-(--color-ink) font-semibold border border-(--color-warn)">
                Backfill
              </span>
            )}
            {isEditing && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-(--color-accent2)/20 text-(--color-ink) font-semibold border border-(--color-accent2)">
                Edited
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-(--color-ink-soft) hover:bg-(--color-surface) active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {step === 'header' ? (
            /* STEP 1: DAY HEADER */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-base font-bold text-(--color-ink)">
                  How was your day?
                </h2>
                <p className="text-xs text-(--color-ink-soft)">
                  Fill the day header and pick your logging mode.
                </p>
              </div>

              {/* Mode choice segmented toggle */}
              <div className="bg-(--color-bg) p-1 rounded-(--radius-pill) border-2 border-(--color-line) grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setMode('full')}
                  className={`py-2 text-xs font-semibold rounded-(--radius-pill) transition-all ${
                    mode === 'full'
                      ? 'bg-(--color-accent) text-white shadow-xs'
                      : 'text-(--color-ink-soft)'
                  }`}
                >
                  Full mode
                </button>
                <button
                  type="button"
                  onClick={() => setMode('quick')}
                  className={`py-2 text-xs font-semibold rounded-(--radius-pill) transition-all ${
                    mode === 'quick'
                      ? 'bg-(--color-accent) text-white shadow-xs'
                      : 'text-(--color-ink-soft)'
                  }`}
                >
                  Quick mode
                </button>
              </div>

              {/* Title & One-liner */}
              <div className="sticker-card p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-(--color-ink) block mb-1">
                    Day title
                  </label>
                  <input
                    type="text"
                    value={title}
                    placeholder="e.g. A productive rainy Tuesday..."
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs p-2 rounded-(--radius-m) border-2 border-(--color-line) bg-(--color-bg) text-(--color-ink) focus:outline-none focus:border-(--color-accent)"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-(--color-ink) block mb-1">
                    One-liner summary
                  </label>
                  <input
                    type="text"
                    value={oneliner}
                    placeholder="e.g. Finished chapter 2 and walked in the park."
                    onChange={(e) => setOneliner(e.target.value)}
                    className="w-full text-xs p-2 rounded-(--radius-m) border-2 border-(--color-line) bg-(--color-bg) text-(--color-ink) focus:outline-none focus:border-(--color-accent)"
                  />
                </div>
              </div>

              {/* Sticker, Rating & Memorability */}
              <div className="sticker-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-(--color-ink) block">
                      Day sticker
                    </span>
                    <span className="text-[11px] text-(--color-ink-soft)">
                      Pick a symbol for today
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStickerPickerOpen(true)}
                    className="w-12 h-12 rounded-(--radius-m) border-2 border-(--color-line) bg-(--color-bg) flex items-center justify-center active:scale-95"
                  >
                    {selectedSticker ? (
                      <img
                        src={selectedSticker.url}
                        alt={selectedSticker.name}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <Smile size={20} className="text-(--color-accent)" />
                    )}
                  </button>
                </div>

                {/* Overall Rating Slider with flowing gradient */}
                <ScaleWidget
                  label="Overall day rating"
                  value={overallRating}
                  config={{ min: 0, max: 10, step: 0.5, display: 'slider' }}
                  onChange={setOverallRating}
                />

                {/* Memorability chips (Star is glowing standalone star icon) */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-(--color-ink) block">
                    Memorability
                  </span>
                  <div className="grid grid-cols-4 gap-1.5 items-center">
                    {[
                      { val: 0 as Memorability, label: 'Normal' },
                      { val: 1 as Memorability, label: 'Notable' },
                      { val: 2 as Memorability, label: 'Outstanding' },
                    ].map((m) => {
                      const isSelected = memorability === m.val
                      return (
                        <button
                          key={m.val}
                          type="button"
                          onClick={() => setMemorability(m.val)}
                          className={`flex items-center justify-center py-2 px-1 rounded-(--radius-pill) text-[11px] font-semibold border-2 transition-all ${
                            isSelected
                              ? 'border-(--color-accent) bg-(--color-accent) text-white shadow-xs'
                              : 'border-(--color-line) bg-(--color-bg) text-(--color-ink-soft)'
                          }`}
                        >
                          <span>{m.label}</span>
                        </button>
                      )
                    })}

                    {/* Glowing standalone star chip */}
                    <button
                      type="button"
                      onClick={() => setMemorability(3)}
                      className={`flex items-center justify-center py-2 px-1 rounded-(--radius-pill) border-2 transition-all ${
                        memorability === 3
                          ? 'border-(--color-star) bg-(--color-star) text-white shadow-[0_0_12px_rgba(255,184,77,0.8) scale-105'
                          : 'border-(--color-line) bg-(--color-bg) text-(--color-star)'
                      }`}
                      aria-label="Star day"
                    >
                      <Star
                        size={18}
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
                className="w-full py-3 rounded-(--radius-pill) bg-(--color-accent) text-white font-bold text-sm sticker-button"
              >
                Continue to questions
              </button>
            </div>
          ) : (
            /* STEP 2: QUESTIONS */
            <div className="space-y-4">
              {/* Full mode prominent section heading and progress bar */}
              {mode === 'full' && sections.length > 0 && (
                <div className="space-y-2 pb-2">
                  <div className="flex items-center space-x-1">
                    {sections.map((sec, idx) => (
                      <div
                        key={sec.id}
                        onClick={() => setCurrentSectionIndex(idx)}
                        className={`h-2 flex-1 rounded-full cursor-pointer transition-colors ${
                          idx === currentSectionIndex
                            ? 'bg-(--color-accent)'
                            : idx < currentSectionIndex
                              ? 'bg-(--color-accent)/50'
                              : 'bg-(--color-line)'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Prominent Section Heading */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-2">
                      <FolderOpen size={18} className="text-(--color-accent)" />
                      <h3 className="text-base font-extrabold tracking-tight text-(--color-ink)">
                        {currentSection?.name}
                      </h3>
                    </div>
                    <span className="text-[11px] font-semibold text-(--color-ink-soft) px-2 py-0.5 rounded-full bg-(--color-bg) border border-(--color-line)">
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

                  const sessions = q.repeats
                    ? repeatingSessions[q.id] || [0]
                    : [0]

                  const isCycleQuestion = q.special === 'cycle'

                  // Check overlapping time ranges
                  const timeParts = qParts.filter((p) => p.kind === 'timerange')
                  const timeAnswers = timeParts.flatMap((p) => {
                    return sessions.map((inst) => answersMap[p.id]?.[inst]).filter(Boolean) as {
                      start: string
                      end: string
                      crossesMidnight: boolean
                    }[]
                  })
                  const hasOverlap = checkOverlappingTimeRanges(timeAnswers)

                  // Special Period / Cycle block styling
                  if (isCycleQuestion) {
                    return (
                      <div
                        key={q.id}
                        className="p-4 rounded-(--radius-l) border-2 border-rose-200 bg-rose-50/50 space-y-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Droplet size={18} className="text-rose-500 fill-rose-500" />
                            <h4 className="font-bold text-sm text-rose-950">
                              {q.label}
                            </h4>
                          </div>
                          {activeCycle && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-800">
                              Period active
                            </span>
                          )}
                        </div>

                        {/* Start / End Period Button */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={handleToggleCycle}
                            className={`w-full py-2 px-3 rounded-(--radius-pill) font-bold text-xs shadow-xs transition-transform active:scale-95 ${
                              activeCycle
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-rose-500 text-white'
                            }`}
                          >
                            {activeCycle ? 'End period today' : 'Start period today'}
                          </button>
                        </div>

                        {/* Daily period symptoms & flow if active */}
                        {activeCycle && (
                          <div className="space-y-2 pt-2 border-t border-rose-200">
                            {qParts.map((p) => {
                              const val = answersMap[p.id]?.[0]
                              return (
                                <div key={p.id}>
                                  {p.kind === 'scale' && (
                                    <ScaleWidget
                                      label={p.label}
                                      value={val as number}
                                      config={p.config as any}
                                      onChange={(v) => handleAnswerChange(p.id, 0, v)}
                                    />
                                  )}
                                  {p.kind === 'library' && (
                                    <LibraryWidget
                                      label={p.label}
                                      value={val as any}
                                      config={p.config as any}
                                      onChange={(v) => handleAnswerChange(p.id, 0, v)}
                                    />
                                  )}
                                  {p.kind === 'text' && (
                                    <TextWidget
                                      label={p.label}
                                      value={(val as string) ?? ''}
                                      onChange={(v) => handleAnswerChange(p.id, 0, v)}
                                    />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  }

                  const hasCorePart = qParts.some((p) => p.level === 'core')

                  return (
                    <div
                      key={q.id}
                      className={`sticker-card p-4 space-y-3 ${
                        hasCorePart ? 'border-l-4 border-l-(--color-accent)' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-sm text-(--color-ink)">
                            {q.label}
                          </h4>
                          {hasCorePart && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-(--color-accent)/15 text-(--color-accent) tracking-wider uppercase">
                              Core
                            </span>
                          )}
                        </div>

                        {q.repeats && isGateOn && (
                          <button
                            type="button"
                            onClick={() => addSession(q.id)}
                            className="flex items-center space-x-1 px-2.5 py-0.5 rounded-(--radius-pill) bg-(--color-bg) border border-(--color-line) text-[10px] font-semibold text-(--color-accent) active:scale-95"
                          >
                            <Plus size={10} />
                            <span>Add session</span>
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
                          onChange={(val) => handleAnswerChange(gatePart.id, 0, val ?? false)}
                        />
                      )}

                      {/* Render sessions and sibling parts */}
                      {(!gatePart || isGateOn) && (
                        <div className="space-y-3">
                          {sessions.map((instance, sIdx) => (
                            <div
                              key={instance}
                              className={
                                q.repeats && sessions.length > 1
                                  ? 'p-3 bg-(--color-bg)/50 rounded-(--radius-m) border border-(--color-line) space-y-2'
                                  : 'space-y-2'
                              }
                            >
                              {q.repeats && sessions.length > 1 && (
                                <div className="flex items-center justify-between text-xs font-semibold text-(--color-ink-soft) pb-1 border-b border-(--color-line)">
                                  <span>Session {sIdx + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeSession(q.id, instance)}
                                    className="text-red-400 hover:text-red-600"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}

                              {qParts
                                .filter((p) => !p.gate)
                                .filter((p) => (mode === 'quick' && !expandedMore ? p.level === 'core' : true))
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
                                          onChange={(v) => handleAnswerChange(p.id, instance, v ?? false)}
                                        />
                                      )}
                                      {p.kind === 'scale' && (
                                        <ScaleWidget
                                          label={p.label}
                                          value={val as number}
                                          required={isCore}
                                          config={p.config as any}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      )}
                                      {p.kind === 'number' && (
                                        <NumberWidget
                                          label={p.label}
                                          value={val as number}
                                          config={p.config as any}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      )}
                                      {p.kind === 'text' && (
                                        <TextWidget
                                          label={p.label}
                                          value={(val as string) ?? ''}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      )}
                                      {p.kind === 'timerange' && (
                                        <TimeRangeWidget
                                          label={p.label}
                                          value={val as any}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      )}
                                      {p.kind === 'library' && (
                                        <LibraryWidget
                                          label={p.label}
                                          value={val as any}
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
                    className="text-xs font-semibold text-(--color-accent) hover:underline inline-flex items-center space-x-1"
                  >
                    <Sparkles size={13} />
                    <span>{expandedMore ? 'Show fewer questions' : 'More questions (show extras)'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="p-3 border-t-2 border-(--color-line) bg-(--color-surface)">
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
                className="py-2.5 px-4 rounded-(--radius-pill) border-2 border-(--color-line) bg-(--color-surface) font-semibold text-xs text-(--color-ink) flex items-center space-x-1 active:scale-95"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              {mode === 'full' && currentSectionIndex < sections.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentSectionIndex(currentSectionIndex + 1)}
                  className="flex-1 py-2.5 rounded-(--radius-pill) bg-(--color-accent) text-white font-semibold text-xs flex items-center justify-center space-x-1 sticker-button"
                >
                  <span>Next section</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!completeness.complete}
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-(--radius-pill) bg-(--color-accent) text-white font-bold text-xs sticker-button disabled:opacity-50 disabled:shadow-none"
                >
                  {completeness.complete ? 'Save tonight' : 'Answer required core questions'}
                </button>
              )}
            </div>
          ) : null}
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
