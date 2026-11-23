import { describe, it, expect } from 'vitest'
import {
  logicalDate,
  isWindowOpen,
  canBackfill,
  calculateMinutes,
  addDays,
} from '../core/logicalDay'

describe('Logical Day & Form Window', () => {
  it('correctly calculates logicalDate across window edges and midnight', () => {
    // Window is 21:00 to 03:00
    // Test date: 2026-10-15 at 21:00 -> belongs to 2026-10-15
    const at2100 = new Date(2026, 9, 15, 21, 0, 0)
    expect(logicalDate(at2100, 'UTC', 3)).toBe('2026-10-15')

    // 2026-10-15 at 23:59 -> belongs to 2026-10-15
    const at2359 = new Date(2026, 9, 15, 23, 59, 0)
    expect(logicalDate(at2359, 'UTC', 3)).toBe('2026-10-15')

    // 2026-10-16 at 00:01 (past midnight, before 03:00) -> belongs to previous date (2026-10-15)
    const at0001 = new Date(2026, 9, 16, 0, 1, 0)
    expect(logicalDate(at0001, 'UTC', 3)).toBe('2026-10-15')

    // 2026-10-16 at 02:59 -> belongs to 2026-10-15
    const at0259 = new Date(2026, 9, 16, 2, 59, 0)
    expect(logicalDate(at0259, 'UTC', 3)).toBe('2026-10-15')

    // 2026-10-16 at 03:00 (window closed) -> belongs to calendar date 2026-10-16
    const at0300 = new Date(2026, 9, 16, 3, 0, 0)
    expect(logicalDate(at0300, 'UTC', 3)).toBe('2026-10-16')

    // 2026-10-16 at 14:00 (daytime) -> belongs to 2026-10-16
    const at1400 = new Date(2026, 9, 16, 14, 0, 0)
    expect(logicalDate(at1400, 'UTC', 3)).toBe('2026-10-16')
  })

  it('determines whether the nightly window is open', () => {
    // Window: 21:00 to 03:00
    const at2059 = new Date(2026, 9, 15, 20, 59, 0)
    expect(isWindowOpen(at2059, 21, 3)).toBe(false)

    const at2100 = new Date(2026, 9, 15, 21, 0, 0)
    expect(isWindowOpen(at2100, 21, 3)).toBe(true)

    const at0259 = new Date(2026, 9, 16, 2, 59, 0)
    expect(isWindowOpen(at0259, 21, 3)).toBe(true)

    const at0300 = new Date(2026, 9, 16, 3, 0, 0)
    expect(isWindowOpen(at0300, 21, 3)).toBe(false)

    const at1200 = new Date(2026, 9, 16, 12, 0, 0)
    expect(isWindowOpen(at1200, 21, 3)).toBe(false)
  })

  it('enforces backfill rules strictly (last 3 days within open chapter)', () => {
    const today = '2026-10-10'
    const chapterStart = '2026-10-01'

    // Today is not a backfill (it is tonight)
    expect(canBackfill('2026-10-10', today, chapterStart)).toBe(false)

    // Yesterday (today-1)
    expect(canBackfill('2026-10-09', today, chapterStart)).toBe(true)

    // Two days ago (today-2)
    expect(canBackfill('2026-10-08', today, chapterStart)).toBe(true)

    // Three days ago (today-3)
    expect(canBackfill('2026-10-07', today, chapterStart)).toBe(true)

    // Four days ago (today-4) -> outside 3-day window
    expect(canBackfill('2026-10-06', today, chapterStart)).toBe(false)

    // Date before chapter start is forbidden even if within 3 days
    const earlyToday = '2026-10-02'
    const laterChapterStart = '2026-10-01'
    expect(canBackfill('2026-10-01', earlyToday, laterChapterStart)).toBe(true)
    expect(canBackfill('2026-09-30', earlyToday, laterChapterStart)).toBe(false)
  })

  it('correctly calculates minutes with midnight crossing', () => {
    // 22:00 to 23:30 (same evening)
    expect(calculateMinutes('22:00', '23:30', false)).toBe(90)

    // 23:30 to 01:15 (crosses midnight)
    expect(calculateMinutes('23:30', '01:15', true)).toBe(105)

    // 00:00 to 07:00
    expect(calculateMinutes('00:00', '07:00', false)).toBe(420)
  })

  it('correctly increments and formats dates via addDays', () => {
    expect(addDays('2026-10-01', 27)).toBe('2026-10-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})
