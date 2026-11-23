import { describe, it, expect } from 'vitest'
import { calculateCycleStats } from '../core/cycle'
import type { Cycle } from '../data/types'

describe('Menstrual Cycle Statistics & Prediction (Phase 3)', () => {
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
})
