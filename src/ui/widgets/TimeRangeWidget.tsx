import React, { useState, useRef, useCallback } from 'react'
import { Clock, Plus, Minus, Moon, Sun } from 'lucide-react'
import type { TimeRangeValue } from '../../data/types'

interface TimeRangeWidgetProps {
  label: string
  value?: TimeRangeValue
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
  end: string
): { durationMinutes: number; crossesMidnight: boolean } {
  const sMin = timeToMinutes(start)
  const eMin = timeToMinutes(end)
  let diff = eMin - sMin
  let crossesMidnight = false
  if (diff <= 0) {
    diff += 1440
    crossesMidnight = true
  }
  return { durationMinutes: diff, crossesMidnight }
}

export function formatMinutesToHours(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export const TimeRangeWidget: React.FC<TimeRangeWidgetProps> = ({
  label,
  value,
  onChange,
  disabled,
}) => {
  const [start, setStart] = useState(value?.start || '23:00')
  const [end, setEnd] = useState(value?.end || '07:00')
  const [activeDraggingHandle, setActiveDraggingHandle] = useState<'start' | 'end' | null>(null)
  const dialRef = useRef<SVGSVGElement>(null)

  const { durationMinutes, crossesMidnight } = calculateTimeRangeDuration(start, end)

  const handleUpdate = (newStart: string, newEnd: string) => {
    setStart(newStart)
    setEnd(newEnd)
    const res = calculateTimeRangeDuration(newStart, newEnd)
    onChange({
      start: newStart,
      end: newEnd,
      crossesMidnight: res.crossesMidnight,
    })
  }

  // Steppers (+15m / -15m)
  const adjustTime = (target: 'start' | 'end', deltaMin: number) => {
    if (disabled) return
    if (target === 'start') {
      const current = timeToMinutes(start)
      const next = minutesToTime(current + deltaMin)
      handleUpdate(next, end)
    } else {
      const current = timeToMinutes(end)
      const next = minutesToTime(current + deltaMin)
      handleUpdate(start, next)
    }
  }

  // Circular Dial Geometry: Center (100, 100), Radius = 76
  const CX = 100
  const CY = 100
  const R = 72

  // Convert minutes from midnight (0..1440) to degrees (0..360, 0deg at top = 12am)
  const minToAngle = (min: number) => (min / 1440) * 360
  const angleToPoint = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return {
      x: CX + R * Math.cos(rad),
      y: CY + R * Math.sin(rad),
    }
  }

  const sAngle = minToAngle(timeToMinutes(start))
  const eAngle = minToAngle(timeToMinutes(end))

  const sPos = angleToPoint(sAngle)
  const ePos = angleToPoint(eAngle)

  // Arc path from start to end (sweep clockwise)
  const angleDiff = ((eAngle - sAngle) % 360 + 360) % 360
  const largeArcFlag = angleDiff > 180 ? 1 : 0
  const arcD = [
    `M ${sPos.x} ${sPos.y}`,
    `A ${R} ${R} 0 ${largeArcFlag} 1 ${ePos.x} ${ePos.y}`,
  ].join(' ')

  // Convert pointer event coordinates on SVG to snapped 15-minute time
  const pointerEventToTime = useCallback(
    (clientX: number, clientY: number): string => {
      if (!dialRef.current) return '00:00'
      const rect = dialRef.current.getBoundingClientRect()
      const x = clientX - rect.left - rect.width / 2
      const y = clientY - rect.top - rect.height / 2
      // atan2 returns angle in radians from positive X axis
      let deg = (Math.atan2(y, x) * 180) / Math.PI + 90
      if (deg < 0) deg += 360
      // 360 deg = 1440 min => 1 deg = 4 min
      const rawMin = (deg / 360) * 1440
      // Snap to nearest 15 minutes
      const snappedMin = Math.round(rawMin / 15) * 15
      return minutesToTime(snappedMin)
    },
    []
  )

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return
    const clickedTime = pointerEventToTime(e.clientX, e.clientY)
    const clickMin = timeToMinutes(clickedTime)
    const curStartMin = timeToMinutes(start)
    const curEndMin = timeToMinutes(end)

    // Calculate circular angular distance
    const distToStart = Math.min(
      Math.abs(clickMin - curStartMin),
      1440 - Math.abs(clickMin - curStartMin)
    )
    const distToEnd = Math.min(
      Math.abs(clickMin - curEndMin),
      1440 - Math.abs(clickMin - curEndMin)
    )

    const handle = distToStart <= distToEnd ? 'start' : 'end'
    setActiveDraggingHandle(handle)
    if (handle === 'start') {
      handleUpdate(clickedTime, end)
    } else {
      handleUpdate(start, clickedTime)
    }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!activeDraggingHandle || disabled) return
    const newTime = pointerEventToTime(e.clientX, e.clientY)
    if (activeDraggingHandle === 'start') {
      handleUpdate(newTime, end)
    } else {
      handleUpdate(start, newTime)
    }
  }

  const handlePointerUp = () => {
    setActiveDraggingHandle(null)
  }

  return (
    <div className="py-2.5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <Clock size={16} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-ink)]">{label}</span>
        </div>
        <div className="flex items-center space-x-1.5">
          {crossesMidnight && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Overnight
            </span>
          )}
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--color-bg)] text-[var(--color-accent)] border border-[var(--color-line)] shadow-xs">
            {formatMinutesToHours(durationMinutes)}
          </span>
        </div>
      </div>

      {/* Tactile Circular 24h Dial Card */}
      <div className="p-4 rounded-[var(--radius-l)] border-2 border-[var(--color-line)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-bg)] shadow-xs space-y-3 select-none">
        {/* SVG Radial Dial */}
        <div className="flex flex-col items-center justify-center relative">
          <svg
            ref={dialRef}
            viewBox="0 0 200 200"
            className="w-48 h-48 touch-none cursor-pointer"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Background 24h Track Ring */}
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth="12"
              className="opacity-70"
            />

            {/* Hour tick marks every 3 hours (8 ticks) */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
              const pOuter = angleToPoint(deg)
              const rad = ((deg - 90) * Math.PI) / 180
              const pInner = {
                x: CX + (R - 6) * Math.cos(rad),
                y: CY + (R - 6) * Math.sin(rad),
              }
              return (
                <line
                  key={i}
                  x1={pInner.x}
                  y1={pInner.y}
                  x2={pOuter.x}
                  y2={pOuter.y}
                  stroke="var(--color-ink-soft)"
                  strokeWidth="2"
                  className="opacity-40"
                />
              )
            })}

            {/* Colored Active Arc */}
            <path
              d={arcD}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="12"
              strokeLinecap="round"
              className="transition-all"
            />

            {/* Start Handle (Moon / Bed icon indicator) */}
            <g
              transform={`translate(${sPos.x}, ${sPos.y})`}
              className="cursor-grab active:cursor-grabbing"
            >
              <circle
                r="13"
                fill="var(--color-surface)"
                stroke="var(--color-accent)"
                strokeWidth="3.5"
                className="shadow-md"
              />
              <circle r="4" fill="var(--color-accent)" />
            </g>

            {/* End Handle (Sun / Wake icon indicator) */}
            <g
              transform={`translate(${ePos.x}, ${ePos.y})`}
              className="cursor-grab active:cursor-grabbing"
            >
              <circle
                r="13"
                fill="var(--color-accent2)"
                stroke="var(--color-surface)"
                strokeWidth="3"
                className="shadow-md"
              />
              <circle r="4" fill="var(--color-ink)" />
            </g>
          </svg>

          {/* Dial Center Text Info */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-[11px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider">
              Duration
            </span>
            <span className="text-base font-extrabold text-[var(--color-ink)]">
              {formatMinutesToHours(durationMinutes)}
            </span>
            <span className="text-[10px] font-semibold text-[var(--color-accent)] mt-0.5">
              {formatTime12h(start)} → {formatTime12h(end)}
            </span>
          </div>
        </div>

        {/* Start / End Time Controls with Stepper Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          {/* Start Block */}
          <div className="p-2.5 rounded-[var(--radius-m)] bg-[var(--color-surface)] border-2 border-[var(--color-line)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-soft)] flex items-center space-x-1">
                <Moon size={11} className="text-[var(--color-accent)]" />
                <span>Start</span>
              </span>
              <span className="text-xs font-bold text-[var(--color-ink)]">
                {formatTime12h(start)}
              </span>
            </div>

            <div className="flex items-center justify-between space-x-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => adjustTime('start', -15)}
                className="flex-1 py-1 px-1 rounded bg-[var(--color-bg)] text-[var(--color-ink)] font-bold text-[11px] border border-[var(--color-line)] active:scale-95 flex items-center justify-center"
                title="-15 mins"
              >
                <Minus size={12} />
              </button>
              <input
                type="time"
                value={start}
                step={900}
                disabled={disabled}
                onChange={(e) => handleUpdate(e.target.value, end)}
                className="w-16 text-center text-xs font-bold py-1 bg-transparent border-0 text-[var(--color-ink)] focus:outline-none"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => adjustTime('start', 15)}
                className="flex-1 py-1 px-1 rounded bg-[var(--color-bg)] text-[var(--color-ink)] font-bold text-[11px] border border-[var(--color-line)] active:scale-95 flex items-center justify-center"
                title="+15 mins"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* End Block */}
          <div className="p-2.5 rounded-[var(--radius-m)] bg-[var(--color-surface)] border-2 border-[var(--color-line)] space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-soft)] flex items-center space-x-1">
                <Sun size={11} className="text-amber-500" />
                <span>End</span>
              </span>
              <span className="text-xs font-bold text-[var(--color-ink)]">
                {formatTime12h(end)}
              </span>
            </div>

            <div className="flex items-center justify-between space-x-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => adjustTime('end', -15)}
                className="flex-1 py-1 px-1 rounded bg-[var(--color-bg)] text-[var(--color-ink)] font-bold text-[11px] border border-[var(--color-line)] active:scale-95 flex items-center justify-center"
                title="-15 mins"
              >
                <Minus size={12} />
              </button>
              <input
                type="time"
                value={end}
                step={900}
                disabled={disabled}
                onChange={(e) => handleUpdate(start, e.target.value)}
                className="w-16 text-center text-xs font-bold py-1 bg-transparent border-0 text-[var(--color-ink)] focus:outline-none"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => adjustTime('end', 15)}
                className="flex-1 py-1 px-1 rounded bg-[var(--color-bg)] text-[var(--color-ink)] font-bold text-[11px] border border-[var(--color-line)] active:scale-95 flex items-center justify-center"
                title="+15 mins"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            { label: 'Sleep 11p - 7a', s: '23:00', e: '07:00' },
            { label: 'Sleep 10p - 6a', s: '22:00', e: '06:00' },
            { label: 'Sleep 12a - 8a', s: '00:00', e: '08:00' },
            { label: 'Nap 2p - 3p', s: '14:00', e: '15:00' },
            { label: 'Study 9a - 12p', s: '09:00', e: '12:00' },
            { label: 'Evening 6p - 8:30p', s: '18:00', e: '20:30' },
          ].map((p, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => handleUpdate(p.s, p.e)}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] active:scale-95 transition-all"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
