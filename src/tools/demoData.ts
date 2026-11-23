import type { TrinqleDB } from '../data/db'
import { db as defaultDb } from '../data/db'
import { generateUUIDv7 } from '../core/ids'
import { addDays } from '../core/logicalDay'
import type {
  Chapter,
  Day,
  Answer,
  Cycle,
  ChapterAnswer,
} from '../data/types'

// Simple LCG pseudo-random number generator for deterministic seed
function createSeededPRNG(seed = 42) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const SAMPLE_TITLES = [
  'Morning run by the river',
  'Deep work session',
  'Quiet reading afternoon',
  'Baking bread at home',
  'Long walk with friends',
  'Productive study day',
  'Rainy day listening to music',
  'Cleaned the apartment',
  'Focused coding sprint',
  'Restful Sunday recharge',
]

const SAMPLE_ONELINERS = [
  'Felt calm and present throughout the day.',
  'Good energy in the morning, rested well in the evening.',
  'Accomplished key goals for the week.',
  'Took things slowly and enjoyed a warm tea.',
  'Steady progress on current learning topics.',
]

const STICKERS = ['star', 'cat-face', 'sun', 'moon', 'leaf', 'flower', 'cloud']

export interface DemoDataOptions {
  seed?: number
  daysCount?: number
  referenceDate?: string // Defaults to today YYYY-MM-DD
}

/**
 * Deterministically generates months of plausible structured journal data.
 * Planted effects:
 * - High caffeine (> 3) -> lower sleep duration (< 6 h).
 * - Exercise days -> higher mood (+1.5 average).
 * - Period cycles regular ~28 days with 4-5 days duration.
 * - Zero emojis anywhere!
 */
export async function generateDemoData(
  db: TrinqleDB = defaultDb,
  options: DemoDataOptions = {}
): Promise<{
  chaptersCount: number
  daysCount: number
  answersCount: number
  cyclesCount: number
}> {
  const seed = options.seed ?? 1024
  const rand = createSeededPRNG(seed)

  const refDate = options.referenceDate || new Date().toISOString().slice(0, 10)
  const totalDays = options.daysCount ?? 75

  // Start date = totalDays - 1 days before refDate
  const startDate = addDays(refDate, -totalDays + 1)

  // 1. Plan 3 Chapters:
  // Chapter 1: closed (28 days)
  // Chapter 2: closed (28 days)
  // Chapter 3: open (remainder, e.g. 19-28 days)
  const ch1Start = startDate
  const ch1End = addDays(ch1Start, 27)

  const ch2Start = addDays(ch1End, 1)
  const ch2End = addDays(ch2Start, 27)

  const ch3Start = addDays(ch2End, 1)
  const ch3PlannedEnd = addDays(ch3Start, 27)

  const baseTimestamp = new Date(ch1Start).getTime()

  // Build Chapters
  const chapter1Id = generateUUIDv7(baseTimestamp)
  const chapter2Id = generateUUIDv7(baseTimestamp + 28 * 86400000)
  const chapter3Id = generateUUIDv7(baseTimestamp + 56 * 86400000)

  const chapter1: Chapter = {
    id: chapter1Id,
    title: 'Chapter 1: Foundations',
    summary: 'Building regular rhythms, morning walks, and study discipline.',
    startDate: ch1Start,
    plannedEndDate: ch1End,
    endDate: ch1End,
    status: 'closed',
    themeId: 'cutesy',
    characterId: 'white-cat',
    closedAt: new Date(ch1End).getTime() + 7200000,
    frozen: {
      formSnapshot: {
        sections: [],
        questions: [],
        parts: [],
        libraries: [],
      },
      dashboard: [],
      insights: [],
      themeId: 'cutesy',
      characterId: 'white-cat',
      metadata: {
        daysFilled: 26,
        quickCount: 6,
        fullCount: 20,
        memorableCount: 8,
      },
    },
    createdAt: baseTimestamp,
    updatedAt: baseTimestamp,
  }

  const chapter2: Chapter = {
    id: chapter2Id,
    title: 'Chapter 2: Deep Focus',
    summary: 'Stepping up workout consistency and reducing caffeine late in the day.',
    startDate: ch2Start,
    plannedEndDate: ch2End,
    endDate: ch2End,
    status: 'closed',
    themeId: 'clay',
    characterId: 'cookie-man',
    closedAt: new Date(ch2End).getTime() + 7200000,
    frozen: {
      formSnapshot: {
        sections: [],
        questions: [],
        parts: [],
        libraries: [],
      },
      dashboard: [],
      insights: [],
      themeId: 'clay',
      characterId: 'cookie-man',
      metadata: {
        daysFilled: 27,
        quickCount: 5,
        fullCount: 22,
        memorableCount: 11,
      },
    },
    createdAt: baseTimestamp + 28 * 86400000,
    updatedAt: baseTimestamp + 28 * 86400000,
  }

  const chapter3: Chapter = {
    id: chapter3Id,
    title: 'Chapter 3: Open Horizons',
    startDate: ch3Start,
    plannedEndDate: ch3PlannedEnd,
    status: 'open',
    themeId: 'cutesy',
    characterId: 'white-cat',
    createdAt: baseTimestamp + 56 * 86400000,
    updatedAt: baseTimestamp + 56 * 86400000,
  }

  const chapters: Chapter[] = [chapter1, chapter2, chapter3]

  // Chapter reflection answers
  const chapterAnswers: ChapterAnswer[] = [
    {
      id: generateUUIDv7(chapter1.closedAt!),
      chapterId: chapter1Id,
      promptId: 'q_refl_goals',
      value: 'Completed all core study modules and kept my daily streak alive.',
      createdAt: chapter1.closedAt!,
      updatedAt: chapter1.closedAt!,
    },
    {
      id: generateUUIDv7(chapter2.closedAt!),
      chapterId: chapter2Id,
      promptId: 'q_refl_goals',
      value: 'Felt much more physically fit and noticed clearer thinking.',
      createdAt: chapter2.closedAt!,
      updatedAt: chapter2.closedAt!,
    },
  ]

  // 2. Generate regular ~28 day menstrual cycles (3 completed + 1 active)
  const cycles: Cycle[] = []
  const firstCycleStart = addDays(startDate, 3)
  const cycleStarts = [
    firstCycleStart,
    addDays(firstCycleStart, 28),
    addDays(firstCycleStart, 56),
  ]

  cycleStarts.forEach((cStart) => {
    const cEnd = addDays(cStart, 4) // 5 days bleed
    const cTime = new Date(cStart).getTime()
    cycles.push({
      id: generateUUIDv7(cTime),
      startDate: cStart,
      endDate: cEnd,
      createdAt: cTime,
      updatedAt: cTime,
    })
  })

  // 3. Generate Days and Answers
  const days: Day[] = []
  const answers: Answer[] = []

  let currentDate = startDate
  let dayIdx = 0

  while (currentDate <= refDate && dayIdx < totalDays) {
    const isCurrentRefDate = currentDate === refDate
    // Skip ~5% of days randomly to simulate realistic occasional gaps (unless today)
    const isMissed = !isCurrentRefDate && rand() < 0.06

    if (!isMissed) {
      // Determine chapter
      let chapterId = chapter3Id
      if (currentDate <= ch1End) chapterId = chapter1Id
      else if (currentDate <= ch2End) chapterId = chapter2Id

      // Mode: 80% full, 20% quick
      const mode = rand() < 0.8 ? 'full' : 'quick'
      const backfilled = !isCurrentRefDate && rand() < 0.15

      // Planted effect: caffeine
      const highCaffeine = rand() < 0.3
      const caffeineCups = highCaffeine ? 4 : Math.floor(rand() * 3)

      // Planted effect: exercise
      const didExercise = rand() < 0.55

      // Sleep duration influenced by caffeine
      const sleepHours = highCaffeine
        ? Math.round((5.0 + rand() * 1.5) * 10) / 10 // 5.0 - 6.5
        : Math.round((7.0 + rand() * 1.8) * 10) / 10 // 7.0 - 8.8

      // Mood influenced by exercise & sleep
      let baseMood = 6.0 + rand() * 2.0
      if (didExercise) baseMood += 1.5
      if (sleepHours < 6) baseMood -= 1.5
      const moodVal = Math.min(10, Math.max(1, Math.round(baseMood * 2) / 2))

      // Memorability
      let memorability: 0 | 1 | 2 | 3 = 0
      if (moodVal >= 9 && rand() < 0.4) memorability = 3 // star
      else if (moodVal >= 8 && rand() < 0.5) memorability = 2
      else if (rand() < 0.3) memorability = 1

      const dayTimestamp = new Date(currentDate).getTime() + 75600000

      const dayRecord: Day = {
        date: currentDate,
        chapterId,
        mode,
        memorability,
        overallRating: moodVal,
        title: SAMPLE_TITLES[Math.floor(rand() * SAMPLE_TITLES.length)],
        oneliner: SAMPLE_ONELINERS[Math.floor(rand() * SAMPLE_ONELINERS.length)],
        stickerId: STICKERS[Math.floor(rand() * STICKERS.length)],
        backfilled,
        filledAt: dayTimestamp,
        expandedMore: false,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }
      days.push(dayRecord)

      // Answers:
      // p_mood_val
      answers.push({
        id: generateUUIDv7(dayTimestamp),
        date: currentDate,
        questionId: 'q_mood',
        partId: 'p_mood_val',
        instance: 0,
        value: moodVal,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      // p_sleep_hours
      answers.push({
        id: generateUUIDv7(dayTimestamp + 1),
        date: currentDate,
        questionId: 'q_sleep',
        partId: 'p_sleep_hours',
        instance: 0,
        value: sleepHours,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      // p_caffeine_cups
      answers.push({
        id: generateUUIDv7(dayTimestamp + 2),
        date: currentDate,
        questionId: 'q_diet',
        partId: 'p_caffeine_cups',
        instance: 0,
        value: caffeineCups,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      // p_exercise_did
      answers.push({
        id: generateUUIDv7(dayTimestamp + 3),
        date: currentDate,
        questionId: 'q_exercise',
        partId: 'p_exercise_did',
        instance: 0,
        value: didExercise,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })
    }

    currentDate = addDays(currentDate, 1)
    dayIdx++
  }

  // Write all generated data into Dexie
  await db.transaction(
    'rw',
    [db.chapters, db.chapterAnswers, db.cycles, db.days, db.answers],
    async () => {
      // Clear existing records in these tables
      await db.chapters.clear()
      await db.chapterAnswers.clear()
      await db.cycles.clear()
      await db.days.clear()
      await db.answers.clear()

      // Add bulk
      await db.chapters.bulkAdd(chapters)
      await db.chapterAnswers.bulkAdd(chapterAnswers)
      await db.cycles.bulkAdd(cycles)
      await db.days.bulkAdd(days)
      await db.answers.bulkAdd(answers)
    }
  )

  return {
    chaptersCount: chapters.length,
    daysCount: days.length,
    answersCount: answers.length,
    cyclesCount: cycles.length,
  }
}
