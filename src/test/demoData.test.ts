import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { generateDemoData } from '../tools/demoData'
import { TrinqleDB } from '../data/db'

describe('Seeded Demo Data Generator (Phase 3)', () => {
  let db: TrinqleDB

  beforeEach(async () => {
    db = new TrinqleDB('test_demodata_' + Math.random().toString(36).slice(2))
  })

  it('deterministically generates 3 chapters and planted effects', async () => {
    const stats = await generateDemoData(db, {
      seed: 42,
      daysCount: 75,
      referenceDate: '2026-10-25',
    })

    expect(stats.chaptersCount).toBe(3)
    expect(stats.daysCount).toBeGreaterThan(60)
    expect(stats.cyclesCount).toBe(3)

    // Check chapters
    const chapters = await db.chapters.orderBy('startDate').toArray()
    expect(chapters).toHaveLength(3)

    // First two chapters are closed and frozen
    expect(chapters[0].status).toBe('closed')
    expect(chapters[0].frozen).toBeDefined()
    expect(chapters[0].closedAt).toBeDefined()

    expect(chapters[1].status).toBe('closed')
    expect(chapters[1].frozen).toBeDefined()

    // Third chapter is open
    expect(chapters[2].status).toBe('open')
    expect(chapters[2].frozen).toBeUndefined()

    // Verify planted effects in answers
    const answers = await db.answers.toArray()
    const moodAnswers = answers.filter((a) => a.partId === 'p_mood_val')
    const exerciseAnswers = answers.filter((a) => a.partId === 'p_exercise_did')

    expect(moodAnswers.length).toBeGreaterThan(0)
    expect(exerciseAnswers.length).toBeGreaterThan(0)

    // Exercise correlation check:
    const exerciseDates = new Set(
      exerciseAnswers.filter((a) => a.value === true).map((a) => a.date)
    )
    const exerciseMoods = moodAnswers
      .filter((a) => exerciseDates.has(a.date))
      .map((a) => a.value as number)
    const nonExerciseMoods = moodAnswers
      .filter((a) => !exerciseDates.has(a.date))
      .map((a) => a.value as number)

    const avgExMood =
      exerciseMoods.reduce((a, b) => a + b, 0) / exerciseMoods.length
    const avgNonExMood =
      nonExerciseMoods.reduce((a, b) => a + b, 0) / nonExerciseMoods.length

    // Exercise days should have higher average mood (planted +1.5)
    expect(avgExMood).toBeGreaterThan(avgNonExMood)
  })
})
