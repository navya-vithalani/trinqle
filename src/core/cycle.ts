import type { Cycle } from '../data/types'
import { addDays } from './logicalDay'

export interface CycleStats {
  hasEnoughData: boolean
  cycleCount: number
  averageLengthDays: number | null
  stdDevDays: number | null
  predictedNextStart: string | null
  averageBleedDays: number | null
}

/**
 * Calculates cycle length between two start dates.
 */
function daysBetween(date1: string, date2: string): number {
  const [y1, m1, d1] = date1.split('-').map(Number)
  const [y2, m2, d2] = date2.split('-').map(Number)
  const ms1 = Date.UTC(y1, m1 - 1, d1)
  const ms2 = Date.UTC(y2, m2 - 1, d2)
  return Math.round((ms2 - ms1) / 86400000)
}

/**
 * Computes cycle prediction statistics:
 * Predictions are active ONLY when at least 3 cycles have been recorded.
 */
export function calculateCycleStats(cycles: Cycle[]): CycleStats {
  const sorted = [...cycles]
    .filter((c) => !c.deletedAt)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))

  const count = sorted.length

  if (count < 3) {
    return {
      hasEnoughData: false,
      cycleCount: count,
      averageLengthDays: null,
      stdDevDays: null,
      predictedNextStart: null,
      averageBleedDays: null,
    }
  }

  // Calculate interval between consecutive cycle start dates
  const intervals: number[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = daysBetween(sorted[i].startDate, sorted[i + 1].startDate)
    if (diff > 15 && diff < 60) {
      // Filter extreme outliers (e.g. gaps of months)
      intervals.push(diff)
    }
  }

  if (intervals.length < 2) {
    return {
      hasEnoughData: false,
      cycleCount: count,
      averageLengthDays: null,
      stdDevDays: null,
      predictedNextStart: null,
      averageBleedDays: null,
    }
  }

  const sum = intervals.reduce((acc, val) => acc + val, 0)
  const avg = sum / intervals.length

  const variance =
    intervals.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / intervals.length
  const stdDev = Math.sqrt(variance)

  // Calculate average bleed days (startDate to endDate)
  const bleedDurations: number[] = []
  for (const c of sorted) {
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
      : null

  const lastCycle = sorted[sorted.length - 1]
  const roundedAvg = Math.round(avg)
  const predictedNextStart = addDays(lastCycle.startDate, roundedAvg)

  return {
    hasEnoughData: true,
    cycleCount: count,
    averageLengthDays: Math.round(avg * 10) / 10,
    stdDevDays: Math.round(stdDev * 10) / 10,
    predictedNextStart,
    averageBleedDays: avgBleed,
  }
}
