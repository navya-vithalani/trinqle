import React, { useState, useEffect, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, AlertTriangle, Sparkles, Smile, Star, Plus, Trash2 } from 'lucide-react'
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
} from '../../data/types'
import { FormRepository, DayRepository } from '../../data/repositories'
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
  const [mode, setMode] = useState<EntryMode>('quick')
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

  // Answers state: partId -> instance -> AnswerValue
  const [answersMap, setAnswersMap] = useState<Record<string, Record<number, AnswerValue>>>({})
  const [repeatingSessions, setRepeatingSessions] = useState<Record<string, number[]>>({}) // questionId -> instance numbers

  // Existing day check (editing mode)
  const [isEditing, setIsEditing] = useState(false)

  const isBackfill = date < todayLogicalDate

  const formRepo = useMemo(() => new FormRepository(), [])
  const dayRepo = useMemo(() => new DayRepository(), [])

  // 1. Load schema and existing entry or draft
  useEffect(() => {
    if (!isOpen) return

    async function loadData() {
      const [allSecs, allQs, allParts] = await Promise.all([
        formRepo.getSections(date),
        formRepo.getQuestions(date),
        formRepo.getParts(date),
      ])

      setSections(allSecs)
      setQuestions(allQs)
      setParts(allParts)

      // Initialize default session 0 for repeating questions
      const initSessions: Record<string, number[]> = {}
      allQs.forEach((q) => {
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

        // Load existing answers
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
        // Check for local draft
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
            setMode(parsed.mode || 'quick')
            setAnswersMap(parsed.answers || {})
            if (parsed.sessions) setRepeatingSessions(parsed.sessions)
          } catch {
            // invalid draft
          }
        } else {
          // Defaults
          setAnswersMap({})
          setRepeatingSessions(initSessions)
          setStep('header')
        }
      }
    }

    loadData()
  }, [isOpen, date, formRepo, dayRepo])

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

  // Flatten answers map into Answer[] for the form engine
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
  const snapshot = { questions, parts }
  const completeness = checkCompleteness(snapshot, date, mode, currentAnswerArray, false)

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

    // Remove answers for this instance
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

  const handleSave = async () => {
    if (!completeness.complete) return

    // Convert answersMap into final Answer[] and AnswerLink[]
    const finalAnswers: Answer[] = []
    const finalLinks: AnswerLink[] = []
    const now = Date.now()

    Object.entries(answersMap).forEach(([partId, instMap]) => {
      const part = parts.find((p) => p.id === partId)
      if (!part) return

      Object.entries(instMap).forEach(([instStr, val]) => {
        const instance = parseInt(instStr, 10)
        // Skip untouched extras or empty values
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

        // If library kind, create AnswerLink rows
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
              itemId: name, // stores item identifier/name
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

    // Clear draft
    localStorage.removeItem(`trinqle_draft_${date}`)

    onSaved()
    onClose()
  }

  // Active section questions for full mode
  const currentSection = sections[currentSectionIndex]
  const currentSectionQuestions = questions.filter(
    (q) => q.sectionId === currentSection?.id
  )

  // Core questions for quick mode
  const quickQuestions = questions.filter((q) => {
    const qParts = parts.filter((p) => p.questionId === q.id)
    if (expandedMore) return true
    return qParts.some((p) => p.level === 'core')
  })

  const selectedSticker = stickerId ? getStickerById(stickerId) : undefined

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-md mx-auto h-[92vh] bg-[var(--color-surface)] rounded-t-[var(--radius-l)] border-t-2 border-x-2 border-[var(--color-line)] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[var(--color-line)] bg-[var(--color-bg)]">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-[var(--color-ink)]">
              {date}
            </span>
            {isBackfill && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-warn)]/20 text-[var(--color-ink)] font-semibold border border-[var(--color-warn)]">
                Backfill
              </span>
            )}
            {isEditing && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent2)]/20 text-[var(--color-ink)] font-semibold border border-[var(--color-accent2)]">
                Edited
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)] active:scale-95"
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
                <h2 className="text-base font-bold text-[var(--color-ink)]">
                  How was your day?
                </h2>
                <p className="text-xs text-[var(--color-ink-soft)]">
                  Fill the day header and pick your logging mode.
                </p>
              </div>

              {/* Mode choice segmented toggle */}
              <div className="bg-[var(--color-bg)] p-1 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setMode('quick')}
                  className={`py-2 text-xs font-semibold rounded-[var(--radius-pill)] transition-all ${
                    mode === 'quick'
                      ? 'bg-[var(--color-accent)] text-white shadow-xs'
                      : 'text-[var(--color-ink-soft)]'
                  }`}
                >
                  Quick mode (~2 min)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('full')}
                  className={`py-2 text-xs font-semibold rounded-[var(--radius-pill)] transition-all ${
                    mode === 'full'
                      ? 'bg-[var(--color-accent)] text-white shadow-xs'
                      : 'text-[var(--color-ink-soft)]'
                  }`}
                >
                  Full mode (~10 min)
                </button>
              </div>

              {/* Title & One-liner */}
              <div className="sticker-card p-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-ink)] block mb-1">
                    Day title
                  </label>
                  <input
                    type="text"
                    value={title}
                    placeholder="e.g. A productive rainy Tuesday..."
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xs p-2 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--color-ink)] block mb-1">
                    One-liner summary
                  </label>
                  <input
                    type="text"
                    value={oneliner}
                    placeholder="e.g. Finished chapter 2 and walked in the park."
                    onChange={(e) => setOneliner(e.target.value)}
                    className="w-full text-xs p-2 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
              </div>

              {/* Sticker, Rating & Memorability */}
              <div className="sticker-card p-4 space-y-4">
                {/* Sticker Picker Row */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-ink)] block">
                      Day sticker
                    </span>
                    <span className="text-[11px] text-[var(--color-ink-soft)]">
                      Pick a symbol for today
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStickerPickerOpen(true)}
                    className="w-12 h-12 rounded-[var(--radius-m)] border-2 border-[var(--color-line)] bg-[var(--color-bg)] flex items-center justify-center active:scale-95"
                  >
                    {selectedSticker ? (
                      <img
                        src={selectedSticker.url}
                        alt={selectedSticker.name}
                        className="w-8 h-8 object-contain"
                      />
                    ) : (
                      <Smile size={20} className="text-[var(--color-accent)]" />
                    )}
                  </button>
                </div>

                {/* Overall Rating Slider */}
                <ScaleWidget
                  label="Overall day rating"
                  value={overallRating}
                  config={{ min: 0, max: 10, step: 0.5, display: 'slider' }}
                  onChange={setOverallRating}
                />

                {/* Memorability */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs font-semibold text-[var(--color-ink)] block">
                    Memorability
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { val: 0 as Memorability, label: 'Normal' },
                      { val: 1 as Memorability, label: 'Notable' },
                      { val: 2 as Memorability, label: 'Outstanding' },
                      { val: 3 as Memorability, label: 'Star', isStar: true },
                    ].map((m) => {
                      const isSelected = memorability === m.val
                      return (
                        <button
                          key={m.val}
                          type="button"
                          onClick={() => setMemorability(m.val)}
                          className={`flex items-center justify-center space-x-1 py-1.5 px-1 rounded-[var(--radius-pill)] text-[11px] font-semibold border-2 transition-all ${
                            isSelected
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white shadow-xs'
                              : 'border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-soft)]'
                          }`}
                        >
                          {m.isStar && <Star size={11} className="fill-current" />}
                          <span>{m.label}</span>
                        </button>
                      )
                    })}
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
              {/* Full mode section progress bar */}
              {mode === 'full' && sections.length > 0 && (
                <div className="space-y-1.5 pb-2">
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
                  <div className="flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
                    <span className="font-bold text-[var(--color-ink)]">
                      {currentSection?.name}
                    </span>
                    <span>
                      Section {currentSectionIndex + 1} of {sections.length}
                    </span>
                  </div>
                </div>
              )}

              {/* Render Question Cards */}
              <div className="space-y-3">
                {(mode === 'full' ? currentSectionQuestions : quickQuestions).map((q) => {
                  const qParts = parts.filter((p) => p.questionId === q.id)
                  const gatePart = qParts.find((p) => p.gate)
                  const gateValue = answersMap[gatePart?.id || '']?.[0] ?? false
                  const isGateOn = !!gateValue

                  const sessions = q.repeats
                    ? repeatingSessions[q.id] || [0]
                    : [0]

                  // Check overlapping time ranges for this question
                  const timeParts = qParts.filter((p) => p.kind === 'timerange')
                  const timeAnswers = timeParts.flatMap((p) => {
                    return sessions.map((inst) => answersMap[p.id]?.[inst]).filter(Boolean) as {
                      start: string
                      end: string
                      crossesMidnight: boolean
                    }[]
                  })
                  const hasOverlap = checkOverlappingTimeRanges(timeAnswers)

                  return (
                    <div key={q.id} className="sticker-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-[var(--color-ink)]">
                          {q.label}
                        </h4>
                        {q.repeats && isGateOn && (
                          <button
                            type="button"
                            onClick={() => addSession(q.id)}
                            className="flex items-center space-x-1 px-2 py-0.5 rounded-[var(--radius-pill)] bg-[var(--color-bg)] border border-[var(--color-line)] text-[10px] font-semibold text-[var(--color-accent)]"
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
                          value={isGateOn}
                          onChange={(val) => handleAnswerChange(gatePart.id, 0, val)}
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
                                  ? 'p-3 bg-[var(--color-bg)]/50 rounded-[var(--radius-m)] border border-[var(--color-line)] space-y-2'
                                  : 'space-y-2'
                              }
                            >
                              {q.repeats && sessions.length > 1 && (
                                <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-ink-soft)] pb-1 border-b border-[var(--color-line)]">
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

                                  return (
                                    <div
                                      key={p.id}
                                      className={isMissing ? 'rounded-lg p-1 bg-red-50/80 border border-red-300' : ''}
                                    >
                                      {p.kind === 'yesno' && (
                                        <YesNoWidget
                                          label={p.label}
                                          value={(val as boolean) ?? false}
                                          onChange={(v) => handleAnswerChange(p.id, instance, v)}
                                        />
                                      )}
                                      {p.kind === 'scale' && (
                                        <ScaleWidget
                                          label={p.label}
                                          value={val as number}
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
                    className="text-xs font-semibold text-[var(--color-accent)] hover:underline inline-flex items-center space-x-1"
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
                className="py-2.5 px-4 rounded-[var(--radius-pill)] border-2 border-[var(--color-line)] bg-[var(--color-surface)] font-semibold text-xs text-[var(--color-ink)] flex items-center space-x-1"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>

              {mode === 'full' && currentSectionIndex < sections.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentSectionIndex(currentSectionIndex + 1)}
                  className="flex-1 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-semibold text-xs flex items-center justify-center space-x-1 sticker-button"
                >
                  <span>Next section</span>
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!completeness.complete}
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-xs sticker-button disabled:opacity-50 disabled:shadow-none"
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
