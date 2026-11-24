import type { Cycle } from '../data/types'
import { addDays } from './logicalDay'

export type CyclePhaseName = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'

export interface CycleStats {
  hasEnoughData: boolean
  cycleCount: number
  averageLengthDays: number | null
  stdDevDays: number | null
  predictedNextStart: string | null
  averageBleedDays: number
}

export interface AdaptiveBaseline {
  avgCycleDays: number
  avgPeriodDays: number
  averageLengthDays: number
  averageBleedDays: number
  isColdStart: boolean
  hasEnoughData: boolean
}

/**
 * Calculates calendar days between two YYYY-MM-DD dates (date2 - date1).
 */
export function daysBetween(date1: string, date2: string): number {
  const [y1, m1, d1] = date1.split('-').map(Number)
  const [y2, m2, d2] = date2.split('-').map(Number)
  const ms1 = Date.UTC(y1, m1 - 1, d1)
  const ms2 = Date.UTC(y2, m2 - 1, d2)
  return Math.round((ms2 - ms1) / 86400000)
}

/**
 * Baseline calculations:
 * - Cold Start (No data / < 3 cycles): 28-day cycle, 5-day period baseline from Day 1.
 * - Adaptive Baseline: Rolling average of user's last 3-6 completed cycles,
 *   excluding outlier cycles (< 18 days or > 45 days).
 */
export function calculateAdaptiveBaseline(cycles: Cycle[]): AdaptiveBaseline {
  const completed = [...cycles]
    .filter((c) => !c.deletedAt && c.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  if (completed.length < 3) {
    return {
      avgCycleDays: 28,
      avgPeriodDays: 5,
      averageLengthDays: 28,
      averageBleedDays: 5,
      isColdStart: true,
      hasEnoughData: false,
    }
  }

  // Calculate intervals between consecutive start dates
  const intervals: number[] = []
  for (let i = 0; i < completed.length - 1; i++) {
    const diff = daysBetween(completed[i].startDate, completed[i + 1].startDate)
    // Exclude outlier cycles (< 18 days or > 45 days)
    if (diff >= 18 && diff <= 45) {
      intervals.push(diff)
    }
  }

  // Bleed durations for last 3-6 completed cycles
  const recentCompleted = completed.slice(-6)
  const bleedDurations: number[] = []
  for (const c of recentCompleted) {
    if (c.endDate) {
      const dur = daysBetween(c.startDate, c.endDate) + 1
      if (dur >= 1 && dur <= 14) {
        bleedDurations.push(dur)
      }
    }
  }

  const avgBleed =
    bleedDurations.length > 0
      ? Math.round(
          (bleedDurations.reduce((a, b) => a + b, 0) / bleedDurations.length) * 10
        ) / 10
      : 5

  // Take last 3 to 6 valid intervals
  const recentIntervals = intervals.slice(-6)
  if (recentIntervals.length === 0) {
    return {
      avgCycleDays: 28,
      avgPeriodDays: avgBleed,
      averageLengthDays: 28,
      averageBleedDays: avgBleed,
      isColdStart: true,
      hasEnoughData: false,
    }
  }

  const avgLength =
    recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length
  const roundedLength = Math.round(avgLength * 10) / 10

  return {
    avgCycleDays: roundedLength,
    avgPeriodDays: avgBleed,
    averageLengthDays: roundedLength,
    averageBleedDays: avgBleed,
    isColdStart: false,
    hasEnoughData: true,
  }
}

/**
 * Returns overall cycle statistics and predictions.
 */
export function calculateCycleStats(cycles: Cycle[]): CycleStats {
  const completed = [...cycles]
    .filter((c) => !c.deletedAt && c.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const count = cycles.filter((c) => !c.deletedAt).length

  if (completed.length < 3) {
    return {
      hasEnoughData: false,
      cycleCount: count,
      averageLengthDays: null,
      stdDevDays: null,
      predictedNextStart: null,
      averageBleedDays: 5,
    }
  }

  const intervals: number[] = []
  for (let i = 0; i < completed.length - 1; i++) {
    const diff = daysBetween(completed[i].startDate, completed[i + 1].startDate)
    if (diff >= 18 && diff <= 45) {
      intervals.push(diff)
    }
  }

  if (intervals.length === 0) {
    return {
      hasEnoughData: false,
      cycleCount: count,
      averageLengthDays: null,
      stdDevDays: null,
      predictedNextStart: null,
      averageBleedDays: 5,
    }
  }

  const avgLength =
    intervals.reduce((a, b) => a + b, 0) / intervals.length
  const variance =
    intervals.reduce((acc, val) => acc + Math.pow(val - avgLength, 2), 0) /
    intervals.length
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10

  const bleedDurations = completed.map(
    (c) => daysBetween(c.startDate, c.endDate!) + 1
  )
  const avgBleed =
    bleedDurations.length > 0
      ? Math.round(
          (bleedDurations.reduce((a, b) => a + b, 0) / bleedDurations.length) * 10
        ) / 10
      : 5

  const lastCycle = completed[completed.length - 1]
  const roundedAvg = Math.round(avgLength)
  const predictedNextStart = addDays(lastCycle.startDate, roundedAvg)

  return {
    hasEnoughData: true,
    cycleCount: count,
    averageLengthDays: Math.round(avgLength * 10) / 10,
    stdDevDays: stdDev,
    predictedNextStart,
    averageBleedDays: avgBleed,
  }
}

/**
 * Phase color tokens with soft pastel tones suitable for blending.
 */
export const PHASE_COLORS: Record<CyclePhaseName, string> = {
  menstrual: 'rgba(244, 63, 94, 0.16)', // Soft rose
  follicular: 'rgba(168, 85, 247, 0.12)', // Soft lilac
  ovulatory: 'rgba(99, 102, 241, 0.16)', // Soft periwinkle
  luteal: 'rgba(245, 158, 11, 0.12)', // Soft peach/amber
}

export const PHASE_BORDER_COLORS: Record<CyclePhaseName, string> = {
  menstrual: 'rgba(244, 63, 94, 0.5)',
  follicular: 'rgba(168, 85, 247, 0.4)',
  ovulatory: 'rgba(99, 102, 241, 0.5)',
  luteal: 'rgba(245, 158, 11, 0.4)',
}

/**
 * Computes the menstrual phase for a given day in cycle (1-indexed).
 */
export function getPhaseForCycleDay(
  dayInCycle: number,
  cycleLengthDays = 28,
  periodDurationDays = 5
): {
  phase: CyclePhaseName
  label: string
  color: string
} {
  const normDay = ((dayInCycle - 1) % Math.round(cycleLengthDays)) + 1
  const ovulationDay = Math.max(periodDurationDays + 3, Math.round(cycleLengthDays - 14))

  if (normDay <= periodDurationDays) {
    return {
      phase: 'menstrual',
      label: 'Menstrual Phase',
      color: PHASE_COLORS.menstrual,
    }
  }

  if (normDay < ovulationDay - 1) {
    return {
      phase: 'follicular',
      label: 'Follicular Phase',
      color: PHASE_COLORS.follicular,
    }
  }

  if (normDay <= ovulationDay + 2) {
    return {
      phase: 'ovulatory',
      label: 'Ovulatory Phase',
      color: PHASE_COLORS.ovulatory,
    }
  }

  return {
    phase: 'luteal',
    label: 'Luteal Phase',
    color: PHASE_COLORS.luteal,
  }
}

/**
 * Early End Guardrail: returns true if period ended fewer than 3 days after start.
 */
export function isEarlyEnd(startDate: string, endDate: string): boolean {
  return daysBetween(startDate, endDate) + 1 < 3
}

/**
 * Forgotten End Guardrail: returns true if active period has exceeded 9 days.
 */
export function isForgottenEnd(startDate: string, todayDate: string): boolean {
  return daysBetween(startDate, todayDate) + 1 > 9
}
