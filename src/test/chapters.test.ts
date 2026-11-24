import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateChapterDuration,
  isPlannedEndDateValid,
  getPlannedEndBounds,
  isChapterHardLocked,
  isPreCloseDue,
  getChapterProgress,
} from '../core/chapters'
import { ChapterRepository } from '../data/repositories/ChapterRepository'
import { TrinqleDB } from '../data/db'
import type { Chapter } from '../data/types'

describe('Chapter Lifecycle & Gates (Phase 3)', () => {
  let db: TrinqleDB
  let repo: ChapterRepository

  beforeEach(async () => {
    db = new TrinqleDB('test_chapters_db_' + Math.random().toString(36).slice(2))
    repo = new ChapterRepository(db)
  })

  it('calculates chapter duration and validates up to 45 day bounds', () => {
    const start = '2026-10-01'

    // 1 day: 2026-10-01
    expect(calculateChapterDuration(start, '2026-10-01')).toBe(1)
    expect(isPlannedEndDateValid(start, '2026-10-01')).toBe(true)

    // 20 days: 2026-10-01 to 2026-10-20
    expect(calculateChapterDuration(start, '2026-10-20')).toBe(20)
    expect(isPlannedEndDateValid(start, '2026-10-20')).toBe(true)

    // 45 days: 2026-10-01 to 2026-11-14
    expect(calculateChapterDuration(start, '2026-11-14')).toBe(45)
    expect(isPlannedEndDateValid(start, '2026-11-14')).toBe(true)

    // Invalid > 45 days (46 days)
    expect(isPlannedEndDateValid(start, '2026-11-15')).toBe(false)

    // Invalid before start date
    expect(isPlannedEndDateValid(start, '2026-09-30')).toBe(false)

    const bounds = getPlannedEndBounds(start)
    expect(bounds.minDate).toBe('2026-10-01')
    expect(bounds.maxDate).toBe('2026-11-14')
  })

  it('detects hard-lock and pre-close popup states correctly', () => {
    const chapter: Chapter = {
      id: 'ch_1',
      startDate: '2026-10-01',
      plannedEndDate: '2026-10-28', // 28 days
      status: 'open',
      themeId: 'cutesy',
      characterId: 'white-cat',
      createdAt: 0,
      updatedAt: 0,
    }

    // T-3 days (2026-10-25) -> No pre-close, not locked
    expect(isPreCloseDue(chapter, '2026-10-25')).toBe(false)
    expect(isChapterHardLocked(chapter, '2026-10-25')).toBe(false)

    // T-2 days (2026-10-26) -> Pre-close is due!
    expect(isPreCloseDue(chapter, '2026-10-26')).toBe(true)
    expect(isChapterHardLocked(chapter, '2026-10-26')).toBe(false)

    // T-0 days (2026-10-28) -> Pre-close is due, not yet hard-locked
    expect(isPreCloseDue(chapter, '2026-10-28')).toBe(true)
    expect(isChapterHardLocked(chapter, '2026-10-28')).toBe(false)

    // T+1 day (2026-10-29) -> Hard-locked!
    expect(isChapterHardLocked(chapter, '2026-10-29')).toBe(true)

    // Progress
    const prog = getChapterProgress(chapter, '2026-10-15')
    expect(prog.totalDays).toBe(28)
    expect(prog.currentDayNumber).toBe(15)
    expect(prog.daysRemaining).toBe(13)
  })

  it('closes chapter with ceremony, freezes payload, and creates next chapter', async () => {
    const ch = await repo.createChapter({
      startDate: '2026-10-01',
      plannedEndDate: '2026-10-28',
      title: 'Chapter 1: Beginnings',
    })

    const { closedChapter, nextChapter } = await repo.closeChapterWithCeremony({
      chapterId: ch.id,
      title: 'Chapter 1: Completed Journey',
      summary: 'A wonderful month of daily mindfulness.',
      endDate: '2026-10-28',
    })

    expect(closedChapter.status).toBe('closed')
    expect(closedChapter.closedAt).toBeDefined()
    expect(closedChapter.frozen).toBeDefined()
    expect(closedChapter.title).toBe('Chapter 1: Completed Journey')

    // Next chapter starts day after previous chapter's end date (2026-10-29)
    expect(nextChapter.status).toBe('open')
    expect(nextChapter.startDate).toBe('2026-10-29')

    // Closed chapter is write-protected
    await expect(repo.assertChapterIsOpen(closedChapter.id)).rejects.toThrow(
      'Chapter is closed and write-protected'
    )
  })
})
