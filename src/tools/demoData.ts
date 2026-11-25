import type { TrinqleDB } from '../data/db'
import { db as defaultDb } from '../data/db'
import { generateUUIDv7 } from '../core/ids'
import { addDays, logicalDate, DEFAULT_WINDOW } from '../core/logicalDay'
import { buildFrozenChapter } from '../core/freeze'
import type {
  Chapter,
  Day,
  Answer,
  AnswerLink,
  Cycle,
  ChapterAnswer,
  Item,
} from '../data/types'
import { importFormPack } from '../data/formPack/importer'
import starterPack from '../content/starter-form-pack.json'

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

const SAMPLE_DREAMS = [
  'Dreamed of wandering through an ancient library filled with spiral staircases and quiet sunlight streaming through stained glass windows.',
  'Found a hidden garden behind my old school with unusual glowing plants and a clear stream with stepping stones.',
  'Was walking on the beach at twilight when the ocean waves began to reflect constellations from the night sky.',
  'Traveled by train through snow-covered mountain valleys with friends, watching pine trees drift past.',
  'Floating gently above a lively city market smelling fresh pastries and warm spiced tea.',
]

const SAMPLE_GRATITUDE = [
  'Grateful for peaceful morning silence before the city wakes up.',
  'Thankful for good conversations with friends and steady progress on projects.',
  'Grateful for a warm cup of coffee and sunny afternoon reading.',
  'Thankful for restorative sleep and feeling refreshed today.',
  'Grateful for kindness from strangers and beautiful cloud formations.',
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
  answerLinksCount: number
  cyclesCount: number
}> {
  const seed = options.seed ?? 1024
  const rand = createSeededPRNG(seed)

  // Ensure starter form pack is loaded in database
  const qCount = await db.questions.count()
  if (qCount === 0) {
    await importFormPack(starterPack as any, 'replace', db)
  }

  // Pre-fetch items from workout types and study types for AnswerLinks
  const allItems: Item[] = await db.items.toArray()
  const workoutItems = allItems.filter((i) => i.libraryId === 'lib_workout_types')
  const studyItems = allItems.filter((i) => i.libraryId === 'lib_study_types')

  const refDate = options.referenceDate || logicalDate(new Date(), undefined, DEFAULT_WINDOW.endHour)
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

  // 3. Generate Days, Answers, and AnswerLinks
  const days: Day[] = []
  const answers: Answer[] = []
  const answerLinks: AnswerLink[] = []

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
      const didStudy = rand() < 0.7

      // Sleep duration influenced by caffeine
      const sleepHours = highCaffeine
        ? Math.round((5.0 + rand() * 1.5) * 10) / 10 // 5.0 - 6.5
        : Math.round((7.0 + rand() * 1.8) * 10) / 10 // 7.0 - 8.8

      // Mood influenced by exercise & sleep
      let baseMood = 6.0 + rand() * 2.0
      if (didExercise) baseMood += 1.5
      if (sleepHours < 6) baseMood -= 1.5
      const moodVal = Math.min(10, Math.max(1, Math.round(baseMood * 2) / 2))
      const energyVal = Math.min(10, Math.max(1, Math.round((moodVal - 0.5 + rand() * 1.5) * 10) / 10))
      const happyVal = Math.min(10, Math.max(1, Math.round((moodVal + (rand() - 0.5)) * 10) / 10))

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
      // 1. q_state (mood, energy, happy)
      answers.push({
        id: generateUUIDv7(dayTimestamp),
        date: currentDate,
        questionId: 'q_state',
        partId: 'p_state_mood',
        instance: 0,
        value: moodVal,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      answers.push({
        id: generateUUIDv7(dayTimestamp + 1),
        date: currentDate,
        questionId: 'q_state',
        partId: 'p_state_energy',
        instance: 0,
        value: energyVal,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      answers.push({
        id: generateUUIDv7(dayTimestamp + 2),
        date: currentDate,
        questionId: 'q_state',
        partId: 'p_state_happy',
        instance: 0,
        value: happyVal,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      // Also retain q_mood.p_mood_val for backward compatibility with planted effect tests
      answers.push({
        id: generateUUIDv7(dayTimestamp + 3),
        date: currentDate,
        questionId: 'q_mood',
        partId: 'p_mood_val',
        instance: 0,
        value: moodVal,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      // 2. q_sleep: Timerange crossing midnight (e.g. 23:00 to 07:00)
      const sleepStartHour = 22 + Math.floor(rand() * 2) // 22 or 23
      const sleepEndHour = Math.floor(sleepHours) - (24 - sleepStartHour)
      const sleepEndHourClamped = Math.max(6, Math.min(9, sleepEndHour))
      const sleepWhenVal = {
        start: `${sleepStartHour}:00`,
        end: `0${sleepEndHourClamped}:15`,
        crossesMidnight: true,
      }
      answers.push({
        id: generateUUIDv7(dayTimestamp + 4),
        date: currentDate,
        questionId: 'q_sleep',
        partId: 'p_sleep_when',
        instance: 0,
        value: sleepWhenVal,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      // 3. q_sleep Dream sub-question:
      const hadDream = rand() < 0.45
      answers.push({
        id: generateUUIDv7(dayTimestamp + 5),
        date: currentDate,
        questionId: 'q_sleep',
        partId: 'p_dream_had',
        instance: 0,
        value: hadDream,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      if (hadDream) {
        answers.push({
          id: generateUUIDv7(dayTimestamp + 6),
          date: currentDate,
          questionId: 'q_sleep',
          partId: 'p_dream_story',
          instance: 0,
          value: SAMPLE_DREAMS[Math.floor(rand() * SAMPLE_DREAMS.length)],
          createdAt: dayTimestamp,
          updatedAt: dayTimestamp,
        })
      }

      // 4. q_diet: caffeine cups
      answers.push({
        id: generateUUIDv7(dayTimestamp + 7),
        date: currentDate,
        questionId: 'q_diet',
        partId: 'p_caffeine_cups',
        instance: 0,
        value: caffeineCups,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      // 5. q_fitness:
      answers.push({
        id: generateUUIDv7(dayTimestamp + 8),
        date: currentDate,
        questionId: 'q_fitness',
        partId: 'p_fitness_did',
        instance: 0,
        value: didExercise,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      // Also retain q_exercise.p_exercise_did for existing test suite
      answers.push({
        id: generateUUIDv7(dayTimestamp + 9),
        date: currentDate,
        questionId: 'q_exercise',
        partId: 'p_exercise_did',
        instance: 0,
        value: didExercise,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      if (didExercise) {
        // Workout time range (e.g. 17:30 to 18:30)
        answers.push({
          id: generateUUIDv7(dayTimestamp + 10),
          date: currentDate,
          questionId: 'q_fitness',
          partId: 'p_fitness_when',
          instance: 0,
          value: { start: '17:30', end: '18:30', crossesMidnight: false },
          createdAt: dayTimestamp,
          updatedAt: dayTimestamp,
        })

        // Workout library picker & AnswerLink
        if (workoutItems.length > 0) {
          const pickedWorkout = workoutItems[Math.floor(rand() * workoutItems.length)]
          const fitAnsId = generateUUIDv7(dayTimestamp + 11)
          answers.push({
            id: fitAnsId,
            date: currentDate,
            questionId: 'q_fitness',
            partId: 'p_fitness_type',
            instance: 0,
            value: [pickedWorkout.id],
            createdAt: dayTimestamp,
            updatedAt: dayTimestamp,
          })
          answerLinks.push({
            id: generateUUIDv7(dayTimestamp + 12),
            answerId: fitAnsId,
            date: currentDate,
            libraryId: 'lib_workout_types',
            itemId: pickedWorkout.id,
            createdAt: dayTimestamp,
            updatedAt: dayTimestamp,
          })
        }
      }

      // 6. q_studies:
      answers.push({
        id: generateUUIDv7(dayTimestamp + 13),
        date: currentDate,
        questionId: 'q_studies',
        partId: 'p_studies_did',
        instance: 0,
        value: didStudy,
        createdAt: dayTimestamp,
        updatedAt: dayTimestamp,
      })

      if (didStudy) {
        answers.push({
          id: generateUUIDv7(dayTimestamp + 14),
          date: currentDate,
          questionId: 'q_studies',
          partId: 'p_studies_when',
          instance: 0,
          value: { start: '10:00', end: '12:30', crossesMidnight: false },
          createdAt: dayTimestamp,
          updatedAt: dayTimestamp,
        })

        if (studyItems.length > 0) {
          const pickedStudy = studyItems[Math.floor(rand() * studyItems.length)]
          const studyAnsId = generateUUIDv7(dayTimestamp + 15)
          answers.push({
            id: studyAnsId,
            date: currentDate,
            questionId: 'q_studies',
            partId: 'p_studies_type',
            instance: 0,
            value: [pickedStudy.id],
            createdAt: dayTimestamp,
            updatedAt: dayTimestamp,
          })
          answerLinks.push({
            id: generateUUIDv7(dayTimestamp + 16),
            answerId: studyAnsId,
            date: currentDate,
            libraryId: 'lib_study_types',
            itemId: pickedStudy.id,
            createdAt: dayTimestamp,
            updatedAt: dayTimestamp,
          })
        }
      }

      // 7. Journal text prompt
      if (rand() < 0.6) {
        answers.push({
          id: generateUUIDv7(dayTimestamp + 17),
          date: currentDate,
          questionId: 'q_prompts',
          partId: 'p_prompt_grateful',
          instance: 0,
          value: SAMPLE_GRATITUDE[Math.floor(rand() * SAMPLE_GRATITUDE.length)],
          createdAt: dayTimestamp,
          updatedAt: dayTimestamp,
        })
      }
    }

    currentDate = addDays(currentDate, 1)
    dayIdx++
  }

  // Build real frozen snapshots & chart models for the two closed demo chapters
  const allSections = await db.sections.filter((s) => !s.deletedAt).toArray()
  const allQuestions = await db.questions.filter((q) => !q.deletedAt).toArray()
  const allParts = await db.parts.filter((p) => !p.deletedAt).toArray()
  const allLibraries = await db.libraries.filter((l) => !l.deletedAt).toArray()

  for (const closedCh of [chapter1, chapter2]) {
    const chDays = days.filter((d) => d.chapterId === closedCh.id)
    const chDateSet = new Set(chDays.map((d) => d.date))
    const chAnswers = answers.filter((a) => chDateSet.has(a.date))
    closedCh.frozen = buildFrozenChapter({
      chapter: closedCh,
      days: chDays,
      answers: chAnswers,
      sections: allSections,
      questions: allQuestions,
      parts: allParts,
      libraries: allLibraries,
      title: closedCh.title,
      summary: closedCh.summary,
      endDate: closedCh.endDate,
    })
  }

  // Write all generated data into Dexie
  await db.transaction(
    'rw',
    [db.chapters, db.chapterAnswers, db.cycles, db.days, db.answers, db.answerLinks],
    async () => {
      // Clear existing records in these tables
      await db.chapters.clear()
      await db.chapterAnswers.clear()
      await db.cycles.clear()
      await db.days.clear()
      await db.answers.clear()
      await db.answerLinks.clear()

      // Add bulk
      await db.chapters.bulkAdd(chapters)
      await db.chapterAnswers.bulkAdd(chapterAnswers)
      await db.cycles.bulkAdd(cycles)
      await db.days.bulkAdd(days)
      await db.answers.bulkAdd(answers)
      await db.answerLinks.bulkAdd(answerLinks)
    }
  )

  return {
    chaptersCount: chapters.length,
    daysCount: days.length,
    answersCount: answers.length,
    answerLinksCount: answerLinks.length,
    cyclesCount: cycles.length,
  }
}
