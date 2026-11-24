import React, { useState, useEffect } from 'react'
import { Droplets, ChevronLeft, ChevronRight, AlertCircle, Trash2, Plus, X } from 'lucide-react'
import type { Cycle, Answer } from '../../data/types'
import {
  calculateAdaptiveBaseline,
  getPhaseForCycleDay,
  daysBetween,
  isEarlyEnd,
  isForgottenEnd,
} from '../../core/cycle'
import { addDays } from '../../core/logicalDay'
import { DayRepository } from '../../data/repositories'

interface CycleHealthViewProps {
  cycles: Cycle[]
  activeCycle?: Cycle
  todayLogicalDate: string
  isUpdateModalOpen?: boolean
  onOpenUpdateModal?: () => void
  onCloseUpdateModal?: () => void
  onStartCycle: (date: string) => Promise<void>
  onEndCycle: (cycleId: string, date: string) => Promise<void>
  onUpdateCycle?: (cycle: Cycle) => Promise<void>
  onDeleteCycle: (cycleId: string) => Promise<void>
}

export const CycleHealthView: React.FC<CycleHealthViewProps> = ({
  cycles,
  activeCycle,
  todayLogicalDate,
  isUpdateModalOpen,
  onOpenUpdateModal,
  onCloseUpdateModal,
  onStartCycle,
  onEndCycle,
  onUpdateCycle: _onUpdateCycle,
  onDeleteCycle,
}) => {
  const [viewOffsetMonths, setViewOffsetMonths] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string>(todayLogicalDate)
  const [selectedDayAnswers, setSelectedDayAnswers] = useState<Answer[]>([])
  const [internalModalOpen, setInternalModalOpen] = useState(false)
  const isModalVisible = isUpdateModalOpen !== undefined ? isUpdateModalOpen : internalModalOpen

  const openUpdateModal = () => {
    if (onOpenUpdateModal) onOpenUpdateModal()
    setInternalModalOpen(true)
  }

  const closeUpdateModal = () => {
    if (onCloseUpdateModal) onCloseUpdateModal()
    setInternalModalOpen(false)
  }

  const [earlyEndModalOpen, setEarlyEndModalOpen] = useState(false)
  const [isAddingPastCycle, setIsAddingPastCycle] = useState(false)
  const [pastStart, setPastStart] = useState('')
  const [pastEnd, setPastEnd] = useState('')

  const dayRepo = new DayRepository()
  const baseline = calculateAdaptiveBaseline(cycles)

  // Current calendar view month
  const now = new Date()
  const viewDate = new Date(now.getFullYear(), now.getMonth() + viewOffsetMonths, 1)
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const firstDayWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Load answers for the selected date inspector
  useEffect(() => {
    let isMounted = true
    dayRepo.getAnswersForDate(selectedDate).then((ans) => {
      if (isMounted) setSelectedDayAnswers(ans)
    })
    return () => {
      isMounted = false
    }
  }, [selectedDate])

  // Extract logged health score, energy, and symptoms from answers
  let healthScore: number | string = 'Not logged'
  let energyLevel: number | string = 'Not logged'
  let symptomsList: string[] = []

  selectedDayAnswers.forEach((a) => {
    if (a.questionId.includes('health') && typeof a.value === 'number') {
      healthScore = `${a.value} / 10`
    }
    if (a.questionId.includes('energy') || a.partId.includes('energy')) {
      if (typeof a.value === 'number') energyLevel = `${a.value} / 10`
    }
    if (Array.isArray(a.value)) {
      symptomsList = [...symptomsList, ...a.value.map(String)]
    } else if (typeof a.value === 'string' && (a.questionId.includes('symptom') || a.partId.includes('symptom'))) {
      symptomsList.push(a.value)
    }
  })

  // Set of confirmed logged bleeding dates
  const confirmedPeriodDates = new Set<string>()
  cycles.forEach((c) => {
    if (c.deletedAt) return
    const end = c.endDate || (c.id === activeCycle?.id ? todayLogicalDate : c.startDate)
    let cur = c.startDate
    let safety = 0
    while (cur <= end && safety < 45) {
      confirmedPeriodDates.add(cur)
      cur = addDays(cur, 1)
      safety++
    }
  })

  // Find most recent cycle start date for predicting phases
  const sortedCycles = [...cycles]
    .filter((c) => !c.deletedAt)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  const lastCycleStart = sortedCycles.length > 0 ? sortedCycles[sortedCycles.length - 1].startDate : todayLogicalDate

  // Calendar cells
  const blanks = Array.from({ length: firstDayWeekday })
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const handleEndPeriodClick = () => {
    if (!activeCycle) return
    if (isEarlyEnd(activeCycle.startDate, todayLogicalDate)) {
      setEarlyEndModalOpen(true)
    } else {
      onEndCycle(activeCycle.id, todayLogicalDate)
      closeUpdateModal()
    }
  }

  const activeDaysCount = activeCycle ? daysBetween(activeCycle.startDate, todayLogicalDate) + 1 : 0
  const isForgottenPrompt = activeCycle && isForgottenEnd(activeCycle.startDate, todayLogicalDate)

  return (
    <div className="space-y-2.5">
      {/* Forgotten End Guardrail Banner (> 9 days) */}
      {isForgottenPrompt && (
        <div className="p-2.5 bg-amber-50 rounded-[var(--radius-m)] border border-amber-300 flex items-start justify-between text-xs text-amber-900 shadow-xs">
          <div className="flex items-start space-x-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Active period is at Day {activeDaysCount}.</p>
              <p className="text-[11px] text-amber-800">
                Did your period already end? Tap to confirm when it concluded.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openUpdateModal}
            className="py-1 px-2.5 rounded-full bg-amber-600 text-white font-bold text-[11px] shrink-0 active:scale-95"
          >
            Confirm
          </button>
        </div>
      )}

      {/* Calendar Month Navigation */}
      <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-ink)] px-1">
        <button
          type="button"
          onClick={() => setViewOffsetMonths((m) => m - 1)}
          className="p-1 rounded hover:bg-[var(--color-line)] active:scale-90"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="font-bold">{monthName}</span>

        <button
          type="button"
          onClick={() => setViewOffsetMonths((m) => m + 1)}
          className="p-1 rounded hover:bg-[var(--color-line)] active:scale-90"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[var(--color-ink-soft)]">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Grid: Background Soft Gradient + Foreground Confirmed Capsule */}
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}

        {daysArray.map((dayNum) => {
          const mStr = String(month + 1).padStart(2, '0')
          const dStr = String(dayNum).padStart(2, '0')
          const cellDate = `${year}-${mStr}-${dStr}`

          const isSelected = selectedDate === cellDate
          const isToday = cellDate === todayLogicalDate
          const isConfirmedPeriod = confirmedPeriodDates.has(cellDate)

          // Calculate continuous cycle day offset for background phase prediction gradient
          const diffFromLastStart = daysBetween(lastCycleStart, cellDate)
          let dayInCycle = ((diffFromLastStart % Math.round(baseline.averageLengthDays)) + Math.round(baseline.averageLengthDays)) % Math.round(baseline.averageLengthDays) + 1
          const phaseInfo = getPhaseForCycleDay(
            dayInCycle,
            baseline.averageLengthDays,
            baseline.averageBleedDays
          )

          // Foreground style: confirmed period dates get a distinct solid rounded capsule
          let cellBg = phaseInfo.color
          let textStyle = 'text-[var(--color-ink)] font-semibold'
          let borderStyle = 'border border-[var(--color-line)]/40'

          if (isConfirmedPeriod) {
            cellBg = 'bg-rose-500 text-white font-extrabold shadow-xs'
            textStyle = 'text-white font-extrabold'
            borderStyle = 'border-2 border-rose-600 rounded-lg'
          }

          const ringStyle = isSelected
            ? 'ring-2 ring-[var(--color-accent)] ring-offset-1 z-10'
            : isToday
              ? 'ring-1 ring-[var(--color-ink)] ring-offset-1'
              : ''

          return (
            <button
              key={cellDate}
              type="button"
              onClick={() => setSelectedDate(cellDate)}
              style={!isConfirmedPeriod ? { backgroundColor: phaseInfo.color } : undefined}
              className={`aspect-square rounded-md flex flex-col items-center justify-center relative text-xs transition-transform active:scale-95 ${cellBg} ${textStyle} ${borderStyle} ${ringStyle}`}
            >
              <span className="text-[11px] leading-none">{dayNum}</span>
              {isConfirmedPeriod && (
                <div className="w-1.5 h-1.5 rounded-full bg-white absolute bottom-1" />
              )}
            </button>
          )
        })}
      </div>

      {/* Read-Only Day Inspector Summary Panel (Compact & Clean) */}
      <div className="p-2.5 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-1.5">
        <div className="flex items-center justify-between pb-1 border-b border-[var(--color-line)]">
          <span className="font-bold text-[11px] text-[var(--color-ink)]">
            Log Inspector: {selectedDate}
          </span>
          <span className="text-[9px] text-[var(--color-ink-soft)] uppercase tracking-wider font-semibold">
            {confirmedPeriodDates.has(selectedDate) ? 'Period Confirmed' : 'No Period Logged'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-xs">
          <div className="p-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-line)] text-center">
            <span className="text-[9px] text-[var(--color-ink-soft)] block">Health</span>
            <span className="font-bold text-xs text-[var(--color-ink)]">{healthScore}</span>
          </div>

          <div className="p-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-line)] text-center">
            <span className="text-[9px] text-[var(--color-ink-soft)] block">Energy</span>
            <span className="font-bold text-xs text-[var(--color-ink)]">{energyLevel}</span>
          </div>

          <div className="p-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-line)] text-center">
            <span className="text-[9px] text-[var(--color-ink-soft)] block">Symptoms</span>
            <span className="font-bold text-xs text-[var(--color-ink)] truncate block">
              {symptomsList.length > 0 ? symptomsList.join(', ') : 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* UPDATE CYCLE MODAL (Strict entry point A) */}
      {isModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[var(--color-surface)] w-full max-w-sm rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2.5">
              <div className="flex items-center space-x-2">
                <Droplets size={16} className="text-rose-500" />
                <h3 className="font-bold text-sm text-[var(--color-ink)]">Update Menstrual Cycle</h3>
              </div>
              <button
                type="button"
                onClick={closeUpdateModal}
                className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-90"
              >
                <X size={16} />
              </button>
            </div>

            {/* Primary Action Button */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block">
                Current Status
              </span>
              {activeCycle ? (
                <button
                  type="button"
                  onClick={handleEndPeriodClick}
                  className="w-full py-3 px-4 rounded-[var(--radius-pill)] bg-rose-600 text-white font-extrabold text-sm sticker-button flex items-center justify-center space-x-2 active:scale-95 shadow-md"
                >
                  <Droplets size={16} />
                  <span>End Period Today ({todayLogicalDate})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await onStartCycle(todayLogicalDate)
                    closeUpdateModal()
                  }}
                  className="w-full py-3 px-4 rounded-[var(--radius-pill)] bg-rose-500 text-white font-extrabold text-sm sticker-button flex items-center justify-center space-x-2 active:scale-95 shadow-md"
                >
                  <Droplets size={16} />
                  <span>Start Period Today ({todayLogicalDate})</span>
                </button>
              )}
            </div>

            {/* Past Cycles History & Manual Editing */}
            <div className="space-y-2.5 pt-2 border-t border-[var(--color-line)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--color-ink)]">Cycle History</span>
                <button
                  type="button"
                  onClick={() => setIsAddingPastCycle(!isAddingPastCycle)}
                  className="text-[11px] font-semibold text-[var(--color-accent)] flex items-center space-x-1 active:scale-95"
                >
                  <Plus size={12} />
                  <span>Backfill Past Cycle</span>
                </button>
              </div>

              {/* Add Past Cycle Form */}
              {isAddingPastCycle && (
                <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2 text-xs">
                  <span className="font-bold text-[var(--color-ink)] block">Log Past Cycle</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[var(--color-ink-soft)] block">Start Date</label>
                      <input
                        type="date"
                        value={pastStart}
                        onChange={(e) => setPastStart(e.target.value)}
                        className="w-full p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-semibold text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--color-ink-soft)] block">End Date</label>
                      <input
                        type="date"
                        value={pastEnd}
                        onChange={(e) => setPastEnd(e.target.value)}
                        className="w-full p-1.5 rounded border border-[var(--color-line)] bg-[var(--color-surface)] font-semibold text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddingPastCycle(false)}
                      className="px-2.5 py-1 text-[11px] text-[var(--color-ink-soft)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!pastStart || !pastEnd || pastStart > pastEnd}
                      onClick={async () => {
                        await onStartCycle(pastStart)
                        // If end date specified, end it
                        setIsAddingPastCycle(false)
                        setPastStart('')
                        setPastEnd('')
                      }}
                      className="px-3 py-1 rounded-full bg-rose-500 text-white font-bold text-[11px] disabled:opacity-40"
                    >
                      Save Past Cycle
                    </button>
                  </div>
                </div>
              )}

              {/* Cycles List */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {cycles
                  .filter((c) => !c.deletedAt)
                  .sort((a, b) => b.startDate.localeCompare(a.startDate))
                  .map((c) => {
                    const dur = c.endDate ? daysBetween(c.startDate, c.endDate) + 1 : 'Active'
                    return (
                      <div
                        key={c.id}
                        className="p-2 rounded-[var(--radius-s)] bg-[var(--color-bg)] border border-[var(--color-line)] flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-[var(--color-ink)]">
                            {c.startDate} {c.endDate ? `to ${c.endDate}` : '(Active)'}
                          </span>
                          <span className="text-[10px] text-[var(--color-ink-soft)] block">
                            Duration: {typeof dur === 'number' ? `${dur} days` : dur}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => onDeleteCycle(c.id)}
                            className="p-1 text-[var(--color-ink-soft)] hover:text-red-500 active:scale-90"
                            title="Delete record"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EARLY END GUARDRAIL DIALOG (< 3 Days) */}
      {earlyEndModalOpen && activeCycle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--color-surface)] w-full max-w-xs rounded-[var(--radius-l)] border-2 border-[var(--color-line)] p-4 space-y-3.5 shadow-xl text-xs">
            <div className="flex items-center space-x-2 text-amber-600 font-bold">
              <AlertCircle size={18} />
              <span>Early End Confirmation</span>
            </div>
            <p className="text-[var(--color-ink)] leading-relaxed">
              Your period started less than 3 days ago. Are you sure it ended, or was this spotting?
            </p>
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onEndCycle(activeCycle.id, todayLogicalDate)
                  setEarlyEndModalOpen(false)
                  closeUpdateModal()
                }}
                className="w-full py-2 rounded-full bg-rose-600 text-white font-bold text-xs"
              >
                Yes, Confirm End
              </button>
              <button
                type="button"
                onClick={() => {
                  // Spotting does not reset Cycle Day 1: delete active cycle
                  onDeleteCycle(activeCycle.id)
                  setEarlyEndModalOpen(false)
                  closeUpdateModal()
                }}
                className="w-full py-2 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)] font-semibold text-xs"
              >
                Convert / Discard as Spotting
              </button>
              <button
                type="button"
                onClick={() => setEarlyEndModalOpen(false)}
                className="w-full py-1.5 text-[var(--color-ink-soft)] text-center text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
