import { describe, it, expect } from 'vitest'
import {
  splitTimeRangeIntoHourBins,
  calculateTimeRangeMinutes,
  calculateStreak,
  calculateScaleNumberStats,
  calculateLibraryStats,
} from '../core/metrics'
import type { AnswerLink, Item } from '../data/types'

describe('Metrics Engine: TimeRange & Hour Bins', () => {
  it('correctly splits an 11 PM to 1 AM session across midnight', () => {
    // 23:00 to 01:00 crosses midnight: exactly 60m into bin 23, 60m into bin 0
    const bins = splitTimeRangeIntoHourBins('23:00', '01:00', true)
    expect(bins).toHaveLength(24)
    expect(bins[23]).toBe(60)
    expect(bins[0]).toBe(60)

    // All other bins must be 0
    for (let h = 1; h < 23; h++) {
      expect(bins[h]).toBe(0)
    }

    const totalMinutes = calculateTimeRangeMinutes({
      start: '23:00',
      end: '01:00',
      crossesMidnight: true,
    })
    expect(totalMinutes).toBe(120)
  })

  it('correctly handles midday sessions without crossing midnight', () => {
    // 14:15 to 15:45 = 90 min: 45 min in bin 14, 45 min in bin 15
    const bins = splitTimeRangeIntoHourBins('14:15', '15:45', false)
    expect(bins[14]).toBe(45)
    expect(bins[15]).toBe(45)
    expect(bins[13]).toBe(0)
    expect(bins[16]).toBe(0)

    const totalMinutes = calculateTimeRangeMinutes({
      start: '14:15',
      end: '15:45',
      crossesMidnight: false,
    })
    expect(totalMinutes).toBe(90)
  })

  it('correctly calculates minutes when crossing midnight implicitly with start > end', () => {
    const mins = calculateTimeRangeMinutes({
      start: '22:30',
      end: '02:00',
      crossesMidnight: false, // Even if flag was false, start > end implies midnight cross
    })
    // 22:30 to 24:00 (90m) + 00:00 to 02:00 (120m) = 210m
    expect(mins).toBe(210)
  })
})

describe('Metrics Engine: Streak with Gap Bridging', () => {
  it('bridges skipped days and does not break the streak', () => {
    const entries = [
      { date: '2026-05-01', done: true },
      { date: '2026-05-02', isSkipped: true }, // Gap bridged
      { date: '2026-05-03', done: true },
    ]

    const stats = calculateStreak(entries)
    expect(stats.currentStreak).toBe(2)
    expect(stats.longestStreak).toBe(2)
    expect(stats.totalDone).toBe(2)
    expect(stats.totalEvaluatedDays).toBe(2)
    expect(stats.completionRate).toBe(100)
  })

  it('breaks streak when an explicit false (not done) is recorded', () => {
    const entries = [
      { date: '2026-05-01', done: true },
      { date: '2026-05-02', isSkipped: true }, // Gap bridged
      { date: '2026-05-03', done: true },
      { date: '2026-05-04', done: false }, // Explicit break
      { date: '2026-05-05', done: true },
    ]

    const stats = calculateStreak(entries)
    expect(stats.currentStreak).toBe(1)
    expect(stats.longestStreak).toBe(2)
    expect(stats.totalDone).toBe(3)
    expect(stats.totalEvaluatedDays).toBe(4)
    expect(stats.completionRate).toBe(75) // 3 out of 4 evaluated days
  })
})

describe('Metrics Engine: Scale & Number Stats', () => {
  it('computes rolling 7-day averages and min/max/mean', () => {
    const points = [
      { date: '2026-05-01', value: 8 },
      { date: '2026-05-02', value: 6 },
      { date: '2026-05-03', value: 10 },
      { date: '2026-05-04', value: 4 },
    ]

    const stats = calculateScaleNumberStats(points)
    expect(stats.min).toBe(4)
    expect(stats.max).toBe(10)
    expect(stats.mean).toBe(7) // (8 + 6 + 10 + 4) / 4 = 7
    expect(stats.points).toHaveLength(4)
    expect(stats.points[3].rollingAvg).toBe(7)
  })
})

describe('Metrics Engine: Library Item Stats', () => {
  it('aggregates item usage and day appearances', () => {
    const items: Item[] = [
      { id: 'item_walk', libraryId: 'lib_activity', name: 'Walking', createdAt: 0, updatedAt: 0 },
      { id: 'item_run', libraryId: 'lib_activity', name: 'Running', createdAt: 0, updatedAt: 0 },
    ]

    const links: AnswerLink[] = [
      { id: '1', answerId: 'a1', date: '2026-05-01', libraryId: 'lib_activity', itemId: 'item_walk', createdAt: 0, updatedAt: 0 },
      { id: '2', answerId: 'a2', date: '2026-05-02', libraryId: 'lib_activity', itemId: 'item_walk', createdAt: 0, updatedAt: 0 },
      { id: '3', answerId: 'a3', date: '2026-05-02', libraryId: 'lib_activity', itemId: 'item_run', createdAt: 0, updatedAt: 0 },
      { id: '4', answerId: 'a4', date: '2026-05-03', libraryId: 'lib_activity', itemId: 'item_walk', createdAt: 0, updatedAt: 0 },
    ]

    const stats = calculateLibraryStats(links, items)
    expect(stats.totalUsages).toBe(4)
    expect(stats.uniqueItemCount).toBe(2)
    expect(stats.topItems[0].name).toBe('Walking')
    expect(stats.topItems[0].count).toBe(3)
    expect(stats.topItems[0].firstUsed).toBe('2026-05-01')
    expect(stats.topItems[0].lastUsed).toBe('2026-05-03')
    expect(stats.topItems[1].name).toBe('Running')
    expect(stats.topItems[1].count).toBe(1)
  })
})
