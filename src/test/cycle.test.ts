import { describe, it, expect } from 'vitest'
import {
  calculateCycleStats,
  calculateAdaptiveBaseline,
  isEarlyEnd,
  isForgottenEnd,
  getPhaseForCycleDay,
} from '../core/cycle'
import type { Cycle } from '../data/types'

describe('Menstrual Cycle Statistics & Prediction (Phase 3 & UX Overhaul)', () => {
  it('requires at least 3 cycles for statistical predictions', () => {
    const fewCycles: Cycle[] = [
      {
        id: 'c1',
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c2',
        startDate: '2026-08-29',
        endDate: '2026-09-02',
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const stats = calculateCycleStats(fewCycles)
    expect(stats.hasEnoughData).toBe(false)
    expect(stats.cycleCount).toBe(2)
    expect(stats.averageLengthDays).toBeNull()
    expect(stats.predictedNextStart).toBeNull()
  })

  it('calculates average length, standard deviation, and predicted start when >= 3 cycles', () => {
    // 3 regular 28-day intervals
    const cycles: Cycle[] = [
      {
        id: 'c1',
        startDate: '2026-06-01',
        endDate: '2026-06-05', // 5 days bleed
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c2',
        startDate: '2026-06-29', // 28 days later
        endDate: '2026-07-03',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c3',
        startDate: '2026-07-27', // 28 days later
        endDate: '2026-07-31',
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const stats = calculateCycleStats(cycles)
    expect(stats.hasEnoughData).toBe(true)
    expect(stats.cycleCount).toBe(3)
    expect(stats.averageLengthDays).toBe(28)
    expect(stats.stdDevDays).toBe(0)
    // Next prediction is 2026-07-27 + 28 days = 2026-08-24
    expect(stats.predictedNextStart).toBe('2026-08-24')
    expect(stats.averageBleedDays).toBe(5)
  })

  it('initializes adaptive baseline with cold start 28d cycle and 5d period', () => {
    const baseline = calculateAdaptiveBaseline([])
    expect(baseline.avgCycleDays).toBe(28)
    expect(baseline.avgPeriodDays).toBe(5)
    expect(baseline.hasEnoughData).toBe(false)
  })

  it('filters outlier cycles (< 18 days or > 45 days) from adaptive rolling average', () => {
    const cyclesWithOutliers: Cycle[] = [
      {
        id: 'c1',
        startDate: '2026-01-01',
        endDate: '2026-01-06', // 5d bleed
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c2',
        startDate: '2026-01-31', // 30d interval
        endDate: '2026-02-05', // 5d bleed
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c3',
        startDate: '2026-02-10', // 10d interval (OUTLIER < 18 days)
        endDate: '2026-02-15',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c4',
        startDate: '2026-03-12', // 30d interval from c3
        endDate: '2026-03-17', // 5d bleed
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c5',
        startDate: '2026-05-15', // 74d interval (OUTLIER > 45 days)
        endDate: '2026-05-20',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'c6',
        startDate: '2026-06-14', // 30d interval
        endDate: '2026-06-19', // 5d bleed
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const baseline = calculateAdaptiveBaseline(cyclesWithOutliers)
    // The valid intervals should be 30 days
    expect(baseline.avgCycleDays).toBe(30)
    expect(baseline.avgPeriodDays).toBe(6)
  })

  it('correctly flags early end guardrail (< 3 days)', () => {
    // 1 day (started and ended on same day) -> early end (< 3 days)
    expect(isEarlyEnd('2026-10-01', '2026-10-01')).toBe(true)
    // 2 days (Oct 1 and Oct 2) -> early end (< 3 days)
    expect(isEarlyEnd('2026-10-01', '2026-10-02')).toBe(true)
    // 3 days (Oct 1, 2, 3) -> valid, not early end
    expect(isEarlyEnd('2026-10-01', '2026-10-03')).toBe(false)
    // 5 days (Oct 1 through Oct 5) -> not early end
    expect(isEarlyEnd('2026-10-01', '2026-10-05')).toBe(false)
  })

  it('correctly flags forgotten end guardrail (> 9 days)', () => {
    // 8 days passed (Oct 1 to Oct 8) -> false
    expect(isForgottenEnd('2026-10-01', '2026-10-08')).toBe(false)
    // 9 days passed (Oct 1 to Oct 9) -> false
    expect(isForgottenEnd('2026-10-01', '2026-10-09')).toBe(false)
    // 10 days passed (Oct 1 to Oct 10) -> true (> 9 days)
    expect(isForgottenEnd('2026-10-01', '2026-10-10')).toBe(true)
  })

  it('calculates the 4 menstrual phases accurately across cycle days', () => {
    expect(getPhaseForCycleDay(1, 28, 5).phase).toBe('menstrual')
    expect(getPhaseForCycleDay(5, 28, 5).phase).toBe('menstrual')
    expect(getPhaseForCycleDay(6, 28, 5).phase).toBe('follicular')
    expect(getPhaseForCycleDay(12, 28, 5).phase).toBe('follicular')
    expect(getPhaseForCycleDay(14, 28, 5).phase).toBe('ovulatory')
    expect(getPhaseForCycleDay(16, 28, 5).phase).toBe('ovulatory')
    expect(getPhaseForCycleDay(18, 28, 5).phase).toBe('luteal')
    expect(getPhaseForCycleDay(28, 28, 5).phase).toBe('luteal')
  })
})
