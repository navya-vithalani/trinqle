import React, { useState, useRef, useEffect } from 'react'
import { Clock, Check, X } from 'lucide-react'
import type { TimeRangeValue } from '../../data/types'

interface TimeRangeWidgetProps {
  label: string
  value?: TimeRangeValue
  date?: string // Logical day YYYY-MM-DD
  onChange: (val: TimeRangeValue) => void
  disabled?: boolean
}

/**
 * Converts HH:mm to minutes from midnight (0 to 1439).
 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Converts minutes from midnight to HH:mm string.
 */
export function minutesToTime(totalMin: number): string {
  const normalized = ((totalMin % 1440) + 1440) % 1440
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Formats 24h HH:mm to friendly 12h display (e.g. "11:00 PM").
 */
export function formatTime12h(t: string): string {
  const [hStr, mStr] = t.split(':')
  let h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${mStr} ${ampm}`
}

/**
 * Calculates duration in minutes and whether midnight is crossed.
 */
export function calculateTimeRangeDuration(
  start: string,
  end: string,
  startDayOffset: number = 0,
  _endDayOffset: number = 0
): { durationMinutes: number; crossesMidnight: boolean } {
  const sMin = timeToMinutes(start)
  const eMin = timeToMinutes(end)
  let diff = eMin - sMin
  let crossesMidnight = false

  if (startDayOffset < 0) {
    // Start was yesterday evening (e.g., 20:30 Mon to 06:45 Tue)
    diff = 1440 - sMin + eMin
    crossesMidnight = true
  } else if (diff <= 0) {
    diff += 1440
    crossesMidnight = true
  }

  return { durationMinutes: Math.max(0, diff), crossesMidnight }
}

export function formatMinutesToHours(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getDayAbbrev(dateStr?: string, offsetDays: number = 0): string {
  if (!dateStr) return offsetDays < 0 ? 'Prev' : 'Today'
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays))
  return DAY_ABBREVS[dt.getUTCDay()]
}

/**
 * Dual-Clock Interactive Time Range Pop-up Component.
 */
interface DualClockModalProps {
  isOpen: boolean
  label: string
  date?: string
  initialStart: string
  initialEnd: string
  initialOffset: number
  onConfirm: (start: string, end: string, offset: number) => void
  onClose: () => void
}

export const DualClockModal: React.FC<DualClockModalProps> = ({
  isOpen,
  label,
  date,
  initialStart,
  initialEnd,
  initialOffset,
  onConfirm,
  onClose,
}) => {
  const [start, setStart] = useState(initialStart)
  const [end, setEnd] = useState(initialEnd)
  const [startOffset, setStartOffset] = useState(initialOffset) // 0 or -1

  // Start time phase: 'prev_pm' (offset -1, >= 20:00), 'today_am', 'today_pm'
  const [startPhase, setStartPhase] = useState<'prev_pm' | 'today_am' | 'today_pm'>(() => {
    if (initialOffset < 0) return 'prev_pm'
    const sMin = timeToMinutes(initialStart)
    return sMin >= 720 ? 'today_pm' : 'today_am'
  })

  // End time phase: 'today_am' or 'today_pm' or 'next_am'
  const [endPhase, setEndPhase] = useState<'today_am' | 'today_pm' | 'next_am'>(() => {
    const eMin = timeToMinutes(initialEnd)
    return eMin >= 720 ? 'today_pm' : 'today_am'
  })

  useEffect(() => {
    setStart(initialStart)
    setEnd(initialEnd)
    setStartOffset(initialOffset)
    if (initialOffset < 0) {
      setStartPhase('prev_pm')
    } else {
      const sMin = timeToMinutes(initialStart)
      setStartPhase(sMin >= 720 ? 'today_pm' : 'today_am')
    }
    const eMin = timeToMinutes(initialEnd)
    setEndPhase(eMin >= 720 ? 'today_pm' : 'today_am')
  }, [initialStart, initialEnd, initialOffset, isOpen])

  const startClockRef = useRef<SVGSVGElement>(null)
  const endClockRef = useRef<SVGSVGElement>(null)
  const prevAngleRef = useRef<{ start: number | null; end: number | null }>({
    start: null,
    end: null,
  })

  const { durationMinutes } = calculateTimeRangeDuration(start, end, startOffset)

  // Calculate angle from event relative to center (70, 70)
  const getAngleFromEvent = (
    e: React.PointerEvent<SVGSVGElement>,
    svgEl: SVGSVGElement
  ): number => {
    const rect = svgEl.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy

    // Angle clockwise from 12 o'clock (in degrees 0-360)
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90
    if (deg < 0) deg += 360
    return deg
  }

  // Handle continuous scrubbing for Start Clock
  const handleStartPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!startClockRef.current) return
    const angle = getAngleFromEvent(e, startClockRef.current)

    // Snap to 15-minute intervals (360 deg = 720 min, so 15 min = 7.5 deg)
    const snappedAngle = Math.round(angle / 7.5) * 7.5
    const total12hMin = Math.round((snappedAngle / 360) * 720) % 720
    const rawH = Math.floor(total12hMin / 60)
    const rawM = total12hMin % 60

    // Detect 12-o-clock boundary crossing
    const prevA = prevAngleRef.current.start
    let currentPhase = startPhase

    if (prevA !== null) {
      // Clockwise crossing 12 (from > 300 to < 60)
      if (prevA > 300 && angle < 60) {
        if (currentPhase === 'prev_pm') currentPhase = 'today_am'
        else if (currentPhase === 'today_am') currentPhase = 'today_pm'
      }
      // Anti-clockwise crossing 12 (from < 60 to > 300)
      else if (prevA < 60 && angle > 300) {
        if (currentPhase === 'today_pm') currentPhase = 'today_am'
        else if (currentPhase === 'today_am') currentPhase = 'prev_pm'
      }
    }
    prevAngleRef.current.start = angle

    let finalH = rawH
    let offset = 0

    if (currentPhase === 'prev_pm') {
      finalH = rawH === 0 ? 12 : rawH
      finalH += 12
      offset = -1
      // Lockout at 8:00 PM (20:00) on previous day
      const minFromMidnight = finalH * 60 + rawM
      if (minFromMidnight < 1200) {
        finalH = 20
      }
    } else if (currentPhase === 'today_pm') {
      finalH = rawH === 0 ? 12 : rawH + 12
      offset = 0
    } else {
      finalH = rawH % 12
      offset = 0
    }

    const newStart = `${String(finalH).padStart(2, '0')}:${String(rawM).padStart(2, '0')}`
    setStart(newStart)
    setStartPhase(currentPhase)
    setStartOffset(offset)
  }

  // Handle continuous scrubbing for End Clock
  const handleEndPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!endClockRef.current) return
    const angle = getAngleFromEvent(e, endClockRef.current)

    const snappedAngle = Math.round(angle / 7.5) * 7.5
    const total12hMin = Math.round((snappedAngle / 360) * 720) % 720
    const rawH = Math.floor(total12hMin / 60)
    const rawM = total12hMin % 60

    const prevA = prevAngleRef.current.end
    let currentPhase = endPhase

    if (prevA !== null) {
      if (prevA > 300 && angle < 60) {
        if (currentPhase === 'today_am') currentPhase = 'today_pm'
        else if (currentPhase === 'today_pm') currentPhase = 'next_am'
      } else if (prevA < 60 && angle > 300) {
        if (currentPhase === 'next_am') currentPhase = 'today_pm'
        else if (currentPhase === 'today_pm') currentPhase = 'today_am'
      }
    }
    prevAngleRef.current.end = angle

    let finalH = rawH
    if (currentPhase === 'today_pm') {
      finalH = rawH === 0 ? 12 : rawH + 12
    } else {
      finalH = rawH % 12
    }

    const newEnd = `${String(finalH).padStart(2, '0')}:${String(rawM).padStart(2, '0')}`
    setEnd(newEnd)
    setEndPhase(currentPhase)
  }

  if (!isOpen) return null

  // Pointer angles for rendering clock hands (12 hours = 360 deg)
  const getHandAngle = (timeStr: string) => {
    const min = timeToMinutes(timeStr)
    const h12 = (min % 720) / 60
    return h12 * 30
  }

  const startHandAngle = getHandAngle(start)
  const endHandAngle = getHandAngle(end)

  const startDayLabel = getDayAbbrev(date, startOffset)
  const endDayLabel = getDayAbbrev(date, endPhase === 'next_am' ? 1 : 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--color-surface)] w-full max-w-sm rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2.5">
          <div className="flex items-center space-x-2">
            <Clock size={16} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm text-[var(--color-ink)]">{label}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/50 active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        {/* Timestamp Readout & Day Abbreviations */}
        <div className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] text-xs font-bold text-[var(--color-ink)]">
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-[var(--color-accent)] uppercase">
              {startDayLabel}
            </span>
            <span className="text-sm">{formatTime12h(start)}</span>
          </div>

          <div className="text-[11px] font-semibold text-[var(--color-ink-soft)]">to</div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] text-[var(--color-accent2)] uppercase">
              {endDayLabel}
            </span>
            <span className="text-sm">{formatTime12h(end)}</span>
          </div>
        </div>

        {/* Dual Clocks (Side-by-Side 12-Hour Dials) */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Left Clock: Start Time */}
          <div className="flex flex-col items-center space-y-1.5">
            <span className="text-[11px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider">
              Start
            </span>
            <svg
              ref={startClockRef}
              viewBox="0 0 140 140"
              className="w-32 h-32 touch-none cursor-pointer drop-shadow-sm select-none"
              onPointerDown={(e) => {
                prevAngleRef.current.start = null
                handleStartPointer(e)
              }}
              onPointerMove={(e) => {
                if (e.buttons > 0) handleStartPointer(e)
              }}
            >
              <circle
                cx="70"
                cy="70"
                r="64"
                className="fill-[var(--color-bg)] stroke-[var(--color-line)] stroke-2"
              />
              {/* Hour Numbers 1-12 */}
              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hr, idx) => {
                const a = (idx * 30 * Math.PI) / 180
                const tx = 70 + Math.sin(a) * 48
                const ty = 70 - Math.cos(a) * 48
                return (
                  <text
                    key={hr}
                    x={tx}
                    y={ty + 4}
                    textAnchor="middle"
                    className="text-[10px] font-bold fill-[var(--color-ink-soft)] select-none pointer-events-none"
                  >
                    {hr}
                  </text>
                )
              })}

              {/* Hand Line & Pointer */}
              <line
                x1="70"
                y1="70"
                x2={70 + Math.sin((startHandAngle * Math.PI) / 180) * 42}
                y2={70 - Math.cos((startHandAngle * Math.PI) / 180) * 42}
                className="stroke-[var(--color-accent)] stroke-[3px] stroke-linecap-round"
              />
              <circle
                cx={70 + Math.sin((startHandAngle * Math.PI) / 180) * 42}
                cy={70 - Math.cos((startHandAngle * Math.PI) / 180) * 42}
                r="6"
                className="fill-[var(--color-accent)] stroke-white stroke-2 shadow-sm"
              />
              <circle cx="70" cy="70" r="3.5" className="fill-[var(--color-ink)]" />
            </svg>
            <div className="flex items-center space-x-1 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setStartPhase('prev_pm')
                  setStartOffset(-1)
                  const [h, m] = start.split(':')
                  const newH = (parseInt(h, 10) % 12 || 12) + 12
                  setStart(`${String(newH).padStart(2, '0')}:${m}`)
                }}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  startPhase === 'prev_pm'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-bg)] text-[var(--color-ink-soft)] border border-[var(--color-line)]'
                }`}
              >
                Prev PM
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartPhase('today_am')
                  setStartOffset(0)
                  const [h, m] = start.split(':')
                  const newH = parseInt(h, 10) % 12
                  setStart(`${String(newH).padStart(2, '0')}:${m}`)
                }}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  startPhase === 'today_am'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-bg)] text-[var(--color-ink-soft)] border border-[var(--color-line)]'
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartPhase('today_pm')
                  setStartOffset(0)
                  const [h, m] = start.split(':')
                  const newH = (parseInt(h, 10) % 12 || 12) + 12
                  setStart(`${String(newH).padStart(2, '0')}:${m}`)
                }}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  startPhase === 'today_pm'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-bg)] text-[var(--color-ink-soft)] border border-[var(--color-line)]'
                }`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Right Clock: End Time */}
          <div className="flex flex-col items-center space-y-1.5">
            <span className="text-[11px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider">
              End
            </span>
            <svg
              ref={endClockRef}
              viewBox="0 0 140 140"
              className="w-32 h-32 touch-none cursor-pointer drop-shadow-sm select-none"
              onPointerDown={(e) => {
                prevAngleRef.current.end = null
                handleEndPointer(e)
              }}
              onPointerMove={(e) => {
                if (e.buttons > 0) handleEndPointer(e)
              }}
            >
              <circle
                cx="70"
                cy="70"
                r="64"
                className="fill-[var(--color-bg)] stroke-[var(--color-line)] stroke-2"
              />
              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hr, idx) => {
                const a = (idx * 30 * Math.PI) / 180
                const tx = 70 + Math.sin(a) * 48
                const ty = 70 - Math.cos(a) * 48
                return (
                  <text
                    key={hr}
                    x={tx}
                    y={ty + 4}
                    textAnchor="middle"
                    className="text-[10px] font-bold fill-[var(--color-ink-soft)] select-none pointer-events-none"
                  >
                    {hr}
                  </text>
                )
              })}

              <line
                x1="70"
                y1="70"
                x2={70 + Math.sin((endHandAngle * Math.PI) / 180) * 42}
                y2={70 - Math.cos((endHandAngle * Math.PI) / 180) * 42}
                className="stroke-[var(--color-accent2)] stroke-[3px] stroke-linecap-round"
              />
              <circle
                cx={70 + Math.sin((endHandAngle * Math.PI) / 180) * 42}
                cy={70 - Math.cos((endHandAngle * Math.PI) / 180) * 42}
                r="6"
                className="fill-[var(--color-accent2)] stroke-white stroke-2 shadow-sm"
              />
              <circle cx="70" cy="70" r="3.5" className="fill-[var(--color-ink)]" />
            </svg>
            <div className="flex items-center space-x-1 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setEndPhase('today_am')
                  const [h, m] = end.split(':')
                  const newH = parseInt(h, 10) % 12
                  setEnd(`${String(newH).padStart(2, '0')}:${m}`)
                }}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  endPhase === 'today_am'
                    ? 'bg-[var(--color-accent2)] text-white'
                    : 'bg-[var(--color-bg)] text-[var(--color-ink-soft)] border border-[var(--color-line)]'
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => {
                  setEndPhase('today_pm')
                  const [h, m] = end.split(':')
                  const newH = (parseInt(h, 10) % 12 || 12) + 12
                  setEnd(`${String(newH).padStart(2, '0')}:${m}`)
                }}
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  endPhase === 'today_pm'
                    ? 'bg-[var(--color-accent2)] text-white'
                    : 'bg-[var(--color-bg)] text-[var(--color-ink-soft)] border border-[var(--color-line)]'
                }`}
              >
                PM
              </button>
            </div>
          </div>
        </div>

        {/* Duration Readout & Confirm OK Button */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-line)]">
          <div className="space-y-0.5">
            <span className="text-[10px] text-[var(--color-ink-soft)] block">Total Duration</span>
            <span className="text-sm font-extrabold text-[var(--color-accent)]">
              {formatMinutesToHours(durationMinutes)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onConfirm(start, end, startOffset)
              onClose()
            }}
            className="py-2 px-6 rounded-[var(--radius-pill)] bg-[var(--color-accent)] text-white font-bold text-xs sticker-button flex items-center space-x-1.5 active:scale-95"
          >
            <Check size={14} />
            <span>OK</span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Universal Time Range Widget:
 * Renders vertical summary bar on the form with dynamic 24-hour axis.
 * Clicking opens the Dual-Clock modal.
 */
export const TimeRangeWidget: React.FC<TimeRangeWidgetProps> = ({
  label,
  value,
  date,
  onChange,
  disabled,
}) => {
  // Default to 4:00 PM (16:00) to 6:00 PM (18:00)
  const [start, setStart] = useState(value?.start || '16:00')
  const [end, setEnd] = useState(value?.end || '18:00')
  const [startDayOffset, setStartDayOffset] = useState(value?.startDayOffset ?? 0)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { durationMinutes } = calculateTimeRangeDuration(
    start,
    end,
    startDayOffset
  )

  const handleConfirmTimes = (newStart: string, newEnd: string, newOffset: number) => {
    setStart(newStart)
    setEnd(newEnd)
    setStartDayOffset(newOffset)
    const res = calculateTimeRangeDuration(newStart, newEnd, newOffset)
    onChange({
      start: newStart,
      end: newEnd,
      crossesMidnight: res.crossesMidnight,
      startDayOffset: newOffset,
    })
  }

  // Dynamic 24-hour vertical axis:
  // Standard axis runs 3:00 AM to 3:00 AM (180 min from midnight).
  // If start is before 3:00 AM on previous day (e.g. 21:00 = 9:00 PM),
  // shift the 24-hour window anchor to start time.
  const sMin = timeToMinutes(start)
  let axisStartMin = 180 // 3:00 AM
  if (startDayOffset < 0 || sMin < 180) {
    axisStartMin = sMin // Shift axis anchor dynamically
  }

  // Calculate relative top & height percentage on vertical bar
  let normStartMin = sMin - axisStartMin
  if (normStartMin < 0) normStartMin += 1440
  const topPct = (normStartMin / 1440) * 100
  const heightPct = Math.min(100 - topPct, (durationMinutes / 1440) * 100)

  const startDayLabel = getDayAbbrev(date, startDayOffset)
  const endDayLabel = getDayAbbrev(date, 0)

  return (
    <div className="py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-accent)]">
          {formatMinutesToHours(durationMinutes)}
        </span>
      </div>

      {/* Vertical Summary Bar (Clickable to open Dual-Clock pop-up) */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Time range: ${formatTime12h(start)} to ${formatTime12h(end)}. Click to change.`}
        onClick={() => !disabled && setIsModalOpen(true)}
        className="w-full flex items-center p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border-2 border-[var(--color-line)] cursor-pointer hover:border-[var(--color-accent)]/60 transition-all select-none active:scale-[0.99]"
      >
        {/* Dynamic Vertical Bar */}
        <div className="relative w-8 h-28 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] shrink-0 overflow-hidden shadow-inner">
          {/* Tick markers */}
          <div className="absolute top-[25%] left-0 right-0 h-[1px] bg-[var(--color-line)]/50" />
          <div className="absolute top-[50%] left-0 right-0 h-[1px] bg-[var(--color-line)]/80" />
          <div className="absolute top-[75%] left-0 right-0 h-[1px] bg-[var(--color-line)]/50" />

          {/* Filled active span */}
          <div
            className="absolute left-0.5 right-0.5 rounded-full bg-gradient-to-b from-[var(--color-accent)] to-[var(--color-accent2)] shadow-sm"
            style={{
              top: `${Math.max(2, topPct)}%`,
              height: `${Math.max(6, heightPct)}%`,
            }}
          />
        </div>

        {/* Visual Readout labels on the right */}
        <div className="flex-1 ml-4 flex flex-col justify-between h-28 py-0.5">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block">
              Start ({startDayLabel})
            </span>
            <span className="text-sm font-bold text-[var(--color-ink)]">
              {formatTime12h(start)}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 text-[11px] text-[var(--color-ink-soft)] font-medium">
            <Clock size={12} className="text-[var(--color-accent)]" />
            <span>Tap bar to scrub clock times</span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block">
              End ({endDayLabel})
            </span>
            <span className="text-sm font-bold text-[var(--color-ink)]">{formatTime12h(end)}</span>
          </div>
        </div>
      </div>

      {/* Dual Clock Modal Pop-up */}
      {isModalOpen && (
        <DualClockModal
          isOpen={isModalOpen}
          label={label}
          date={date}
          initialStart={start}
          initialEnd={end}
          initialOffset={startDayOffset}
          onConfirm={handleConfirmTimes}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  )
}
