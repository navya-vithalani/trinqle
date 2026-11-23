import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { TrinqleDB } from '../data/db'
import { ChapterRepository, DayRepository, SettingsRepository } from '../data/repositories'
import { deleteAllData } from '../data/reset'
import type { Day, Answer, FrozenChapter } from '../data/types'

describe('Repositories & Closed Chapter Write Protection', () => {
  let testDb: TrinqleDB
  let chapterRepo: ChapterRepository
  let dayRepo: DayRepository
  let settingsRepo: SettingsRepository

  beforeEach(async () => {
    testDb = new TrinqleDB(`test_repo_${Date.now()}_${Math.random()}`)
    chapterRepo = new ChapterRepository(testDb)
    dayRepo = new DayRepository(testDb)
    settingsRepo = new SettingsRepository(testDb)
  })

  it('allows saving day and answers for an open chapter', async () => {
    // Create open chapter
    const chapter = await chapterRepo.createChapter({
      startDate: '2026-10-01',
      plannedEndDate: '2026-10-28',
      title: 'Chapter 1',
    })
    expect(chapter.status).toBe('open')

    const date = '2026-10-05'
    const day: Day = {
      date,
      chapterId: chapter.id,
      title: 'Great day',
      oneliner: 'Lots accomplished',
      memorability: 1,
      mode: 'quick',
      expandedMore: false,
      backfilled: false,
      filledAt: Date.now(),
      tz: 'UTC',
    }

    const answers: Answer[] = [
      {
        id: 'ans_1',
        date,
        questionId: 'q_mood',
        partId: 'p_mood_val',
        instance: 0,
        value: 8.5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    await dayRepo.saveDay(day, answers)

    const savedDay = await dayRepo.getDay(date)
    expect(savedDay).toBeDefined()
    expect(savedDay?.title).toBe('Great day')

    const savedAnswers = await dayRepo.getAnswersForDate(date)
    expect(savedAnswers.length).toBe(1)
    expect(savedAnswers[0].value).toBe(8.5)
  })

  it('strictly rejects writes to a date belonging to a closed chapter', async () => {
    // 1. Create chapter
    const chapter = await chapterRepo.createChapter({
      startDate: '2026-09-01',
      plannedEndDate: '2026-09-28',
      title: 'Chapter 1',
    })

    const frozenMock: FrozenChapter = {
      formSnapshot: { sections: [], questions: [], parts: [], libraries: [] },
      dashboard: [],
      insights: [],
      themeId: 'cutesy',
      characterId: 'white-cat',
      metadata: { daysFilled: 25, quickCount: 20, fullCount: 5, memorableCount: 3 },
    }

    // 2. Close chapter
    await chapterRepo.closeChapter(chapter.id, frozenMock, 'Closed Chapter 1')

    // 3. Attempt to save or edit a day in that closed chapter
    const dayInClosedChapter: Day = {
      date: '2026-09-15',
      chapterId: chapter.id,
      memorability: 0,
      mode: 'quick',
      expandedMore: false,
      backfilled: false,
      filledAt: Date.now(),
      tz: 'UTC',
    }

    await expect(dayRepo.saveDay(dayInClosedChapter, [])).rejects.toThrow(
      'Chapter is closed and write-protected'
    )

    // Attempting deleteDay also rejected
    await expect(dayRepo.deleteDay('2026-09-15')).rejects.toThrow(
      'Chapter is closed and write-protected'
    )
  })

  it('wipes and resets database cleanly on deleteAllData', async () => {
    // Populate some data
    await chapterRepo.createChapter({
      startDate: '2026-10-01',
      title: 'Temp Chapter',
    })
    await settingsRepo.setSetting('customKey', 'someValue')

    // Invalid confirmation string is rejected
    await expect(deleteAllData('NO', testDb)).rejects.toThrow(
      'Confirmation string must be "DELETE"'
    )

    // Valid confirmation deletes all data
    await deleteAllData('DELETE', testDb)

    const chapters = await chapterRepo.getAllChapters()
    expect(chapters.length).toBe(0)

    // Default settings are re-seeded
    const timeFormat = await settingsRepo.getSetting('timeFormat')
    expect(timeFormat).toBe('12h')
    const weekStart = await settingsRepo.getSetting('weekStart')
    expect(weekStart).toBe(1)
    const characterName = await settingsRepo.getSetting('characterName')
    expect(characterName).toBe('Piqsie')
  })
})
