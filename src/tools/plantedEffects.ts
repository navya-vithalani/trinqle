/**
 * Planted Effects and Pure Noise Synthetic Data Generators for Phase 7 Validation Harness.
 * Generates deterministic structured dataset matching starter-form-pack schema.
 * Zero external dependencies; zero emojis.
 */

import type { Day, Answer, Question, Part, Item, AnswerLink } from '../data/types'
import { addDays } from '../core/logicalDay'

function createPRNG(seed = 42) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

export interface SyntheticDataset {
  days: Day[]
  answers: Answer[]
  questions: Question[]
  parts: Part[]
  items: Item[]
  answerLinks: AnswerLink[]
}

/**
 * Common schema fixtures matching starter pack questions and parts.
 */
export function getStandardQuestionsAndParts(): {
  questions: Question[]
  parts: Part[]
  items: Item[]
} {
  const questions: Question[] = [
    {
      id: 'q_exercise',
      sectionId: 'sec_day',
      label: 'Exercise',
      order: 1,
      repeats: false,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'q_steps',
      sectionId: 'sec_day',
      label: 'Steps',
      order: 2,
      repeats: false,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'q_mood',
      sectionId: 'sec_night',
      label: 'Mood',
      order: 3,
      repeats: false,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'q_sleep',
      sectionId: 'sec_night',
      label: 'Sleep',
      order: 4,
      repeats: false,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'q_social',
      sectionId: 'sec_day',
      label: 'People Met',
      order: 5,
      repeats: false,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'q_dream',
      sectionId: 'sec_night',
      label: 'Dream Themes',
      order: 6,
      repeats: false,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'q_reflection',
      sectionId: 'sec_night',
      label: 'Daily Reflection',
      order: 7,
      repeats: false,
      createdAt: 0,
      updatedAt: 0,
    },
  ]

  const parts: Part[] = [
    {
      id: 'p_exercise_did',
      questionId: 'q_exercise',
      kind: 'yesno',
      label: 'Worked out',
      order: 1,
      level: 'core',
      config: {},
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_steps_val',
      questionId: 'q_steps',
      kind: 'number',
      label: 'Step count',
      order: 1,
      level: 'core',
      config: { unit: 'steps', aggregate: 'sum' },
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_mood_score',
      questionId: 'q_mood',
      kind: 'scale',
      label: 'Rating',
      order: 1,
      level: 'core',
      config: { min: 1, max: 10, step: 1, display: 'slider' },
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_sleep_dur',
      questionId: 'q_sleep',
      kind: 'timerange',
      label: 'Sleep session',
      order: 1,
      level: 'core',
      config: { snapMinutes: 15 },
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_social_people',
      questionId: 'q_social',
      kind: 'library',
      label: 'People',
      order: 1,
      level: 'extra',
      config: { libraryId: 'lib_people', multi: true, creatable: true },
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_dream_themes',
      questionId: 'q_dream',
      kind: 'library',
      label: 'Themes',
      order: 1,
      level: 'extra',
      config: { libraryId: 'lib_themes', multi: true, creatable: true },
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_reflection_note',
      questionId: 'q_reflection',
      kind: 'text',
      label: 'Note',
      order: 1,
      level: 'extra',
      config: { multiline: true },
      createdAt: 0,
      updatedAt: 0,
    },
  ]

  const items: Item[] = [
    {
      id: 'item_alex',
      libraryId: 'lib_people',
      name: 'Alex',
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'item_theme_flying',
      libraryId: 'lib_themes',
      name: 'Flying',
      createdAt: 0,
      updatedAt: 0,
    },
  ]

  return { questions, parts, items }
}

/**
 * 1. Planted Effects Dataset (TRD 7, Plan Phase 7)
 * Generates >= 120 days with known deterministic planted effects:
 * - Exercise -> Mood +1.5 lift
 * - Monday mood -> -1.0 dip
 * - Alex met -> Flying dream 2 days later (60% vs 5% baseline)
 * - Sleep duration step drop after day 70 (8h down to 7h)
 * - Single extreme outlier day for sleep on day 45 (13h)
 * - 4-day rough stretch on days 82..85 (mood 3.0)
 * - Large-range number: Steps (2,000 to 14,000) lifting mood (Spearman rho ~ 0.55)
 * - Reflection note written -> mood lower 2 days later (lag 2)
 */
export function generatePlantedEffectsDataset(
  daysCount = 120,
  seed = 42
): SyntheticDataset {
  const rand = createPRNG(seed)
  const { questions, parts, items } = getStandardQuestionsAndParts()

  const startDate = '2026-06-01'
  const days: Day[] = []
  const answers: Answer[] = []
  const answerLinks: AnswerLink[] = []

  // Pre-generate flags for lag-based dependencies
  const exerciseDays = new Set<number>()
  const alexDays = new Set<number>()
  const regretDays = new Set<number>()
  const stepsPerDay: number[] = new Array(daysCount)

  for (let i = 0; i < daysCount; i++) {
    // Exercise on ~45% of days
    if (rand() < 0.45) exerciseDays.add(i)

    // Met Alex on ~15% of days
    if (rand() < 0.15) alexDays.add(i)

    // Logged a regret reflection note on ~20% of days
    if (rand() < 0.20) regretDays.add(i)

    // Steps: 2,000 to 14,000
    stepsPerDay[i] = Math.round(2000 + rand() * 12000)
  }

  for (let i = 0; i < daysCount; i++) {
    const curDate = addDays(startDate, i)
    const dateObj = new Date(curDate + 'T00:00:00')
    const weekday = dateObj.getDay() // 0 = Sunday, 1 = Monday

    const hasExercise = exerciseDays.has(i)
    const steps = stepsPerDay[i]

    // Base mood centered around 6.5
    let moodVal = 6.5 + (rand() - 0.5) * 1.0

    // Planted effect 1: Exercise lifts mood by +1.5
    if (hasExercise) {
      moodVal += 1.5
    }

    // Planted effect 2: Monday mood dip (-1.0)
    if (weekday === 1) {
      moodVal -= 1.0
    }

    // Planted effect 7: Step count correlation with mood
    // Higher steps (scaled from 2k..14k to -0.6..+0.6)
    const stepNormalized = (steps - 8000) / 6000
    moodVal += stepNormalized * 0.8

    // Planted effect 8: Note written 2 days earlier reduces mood (lag 2)
    if (i >= 2 && regretDays.has(i - 2)) {
      moodVal -= 1.8
    }

    // Planted effect 6: 4-day rough stretch on days 82 to 85
    if (i >= 82 && i <= 85) {
      moodVal = 3.0 + (rand() - 0.5) * 0.4
    }

    // Clamp mood to 1..10
    moodVal = Math.min(10, Math.max(1, Math.round(moodVal * 10) / 10))

    // Planted effect 4: Sleep duration step drop after day 70
    // Days 0..69: 8.0h (480 min). Days 70..119: 7.0h (420 min)
    let sleepMinutes = i < 70 ? 480 + (rand() - 0.5) * 40 : 420 + (rand() - 0.5) * 40

    // Planted effect 5: Extreme single day outlier on day 45 (13h = 780 min)
    if (i === 45) {
      sleepMinutes = 780
    }

    sleepMinutes = Math.round(sleepMinutes)

    // Planted effect 3: Alex met 2 days ago -> Flying dream (60% vs 5% baseline)
    const metAlex2DaysAgo = i >= 2 && alexDays.has(i - 2)
    const hasFlyingDream = metAlex2DaysAgo ? rand() < 0.60 : rand() < 0.05

    // Overall Day Rating: aligned with mood
    const overallRating = Math.min(10, Math.max(1, Math.round(moodVal)))

    days.push({
      date: curDate,
      chapterId: 'ch_test',
      title: `Day ${i + 1}`,
      oneliner: hasExercise ? 'Felt energized from workout' : 'Normal routine',
      overallRating,
      memorability: overallRating >= 9 ? 2 : overallRating >= 8 ? 1 : 0,
      mode: 'full',
      expandedMore: true,
      backfilled: false,
      filledAt: Date.now(),
      tz: 'UTC',
    })

    // Answers:
    // 1. Exercise did
    answers.push({
      id: `ans_ex_${i}`,
      date: curDate,
      questionId: 'q_exercise',
      partId: 'p_exercise_did',
      instance: 0,
      value: hasExercise,
      createdAt: 0,
      updatedAt: 0,
    })

    // 2. Steps
    answers.push({
      id: `ans_steps_${i}`,
      date: curDate,
      questionId: 'q_steps',
      partId: 'p_steps_val',
      instance: 0,
      value: steps,
      createdAt: 0,
      updatedAt: 0,
    })

    // 3. Mood
    answers.push({
      id: `ans_mood_${i}`,
      date: curDate,
      questionId: 'q_mood',
      partId: 'p_mood_score',
      instance: 0,
      value: moodVal,
      createdAt: 0,
      updatedAt: 0,
    })

    // 4. Sleep
    const sleepStartHour = 23
    const sleepEndHour = Math.floor(sleepMinutes / 60) - 1
    const sleepEndMin = sleepMinutes % 60
    answers.push({
      id: `ans_sleep_${i}`,
      date: curDate,
      questionId: 'q_sleep',
      partId: 'p_sleep_dur',
      instance: 0,
      value: {
        start: `${sleepStartHour}:00`,
        end: `${String(sleepEndHour).padStart(2, '0')}:${String(sleepEndMin).padStart(2, '0')}`,
        crossesMidnight: true,
      },
      createdAt: 0,
      updatedAt: 0,
    })

    // 5. Social (Alex)
    if (alexDays.has(i)) {
      answers.push({
        id: `ans_social_${i}`,
        date: curDate,
        questionId: 'q_social',
        partId: 'p_social_people',
        instance: 0,
        value: ['item_alex'],
        createdAt: 0,
        updatedAt: 0,
      })
      answerLinks.push({
        id: `link_alex_${i}`,
        answerId: `ans_social_${i}`,
        date: curDate,
        libraryId: 'lib_people',
        itemId: 'item_alex',
        createdAt: 0,
        updatedAt: 0,
      })
    }

    // 6. Dream (Flying)
    if (hasFlyingDream) {
      answers.push({
        id: `ans_dream_${i}`,
        date: curDate,
        questionId: 'q_dream',
        partId: 'p_dream_themes',
        instance: 0,
        value: ['item_theme_flying'],
        createdAt: 0,
        updatedAt: 0,
      })
      answerLinks.push({
        id: `link_dream_${i}`,
        answerId: `ans_dream_${i}`,
        date: curDate,
        libraryId: 'lib_themes',
        itemId: 'item_theme_flying',
        createdAt: 0,
        updatedAt: 0,
      })
    }

    // 7. Reflection note
    if (regretDays.has(i)) {
      answers.push({
        id: `ans_reflection_${i}`,
        date: curDate,
        questionId: 'q_reflection',
        partId: 'p_reflection_note',
        instance: 0,
        value: 'Felt some regret about earlier decisions today.',
        createdAt: 0,
        updatedAt: 0,
      })
    }
  }

  return { days, answers, questions, parts, items, answerLinks }
}

/**
 * 2. Pure Noise Dataset (TRD 7, Plan Phase 7)
 * Identical structure, but all values drawn independently from pure uniform/normal noise.
 * No planted correlations, no day-of-week biases, no change points.
 */
export function generatePureNoiseDataset(
  daysCount = 120,
  seed = 999
): SyntheticDataset {
  const rand = createPRNG(seed)
  const { questions, parts, items } = getStandardQuestionsAndParts()

  const startDate = '2026-06-01'
  const days: Day[] = []
  const answers: Answer[] = []
  const answerLinks: AnswerLink[] = []

  for (let i = 0; i < daysCount; i++) {
    const curDate = addDays(startDate, i)

    const hasExercise = rand() < 0.5
    const steps = Math.round(2000 + rand() * 12000)
    // Pure independent uniform mood
    const moodVal = Math.round((4.0 + rand() * 4.0) * 10) / 10
    // Pure independent sleep around 450m
    const sleepMinutes = Math.round(420 + rand() * 60)
    const hasAlex = rand() < 0.15
    const hasFlying = rand() < 0.15
    const hasNote = rand() < 0.20
    const rating = Math.round(4 + rand() * 4)

    days.push({
      date: curDate,
      chapterId: 'ch_noise',
      title: `Day ${i + 1}`,
      overallRating: rating,
      memorability: 0,
      mode: 'full',
      expandedMore: true,
      backfilled: false,
      filledAt: Date.now(),
      tz: 'UTC',
    })

    answers.push({
      id: `ans_ex_${i}`,
      date: curDate,
      questionId: 'q_exercise',
      partId: 'p_exercise_did',
      instance: 0,
      value: hasExercise,
      createdAt: 0,
      updatedAt: 0,
    })

    answers.push({
      id: `ans_steps_${i}`,
      date: curDate,
      questionId: 'q_steps',
      partId: 'p_steps_val',
      instance: 0,
      value: steps,
      createdAt: 0,
      updatedAt: 0,
    })

    answers.push({
      id: `ans_mood_${i}`,
      date: curDate,
      questionId: 'q_mood',
      partId: 'p_mood_score',
      instance: 0,
      value: moodVal,
      createdAt: 0,
      updatedAt: 0,
    })

    answers.push({
      id: `ans_sleep_${i}`,
      date: curDate,
      questionId: 'q_sleep',
      partId: 'p_sleep_dur',
      instance: 0,
      value: {
        start: '23:00',
        end: `0${Math.floor(sleepMinutes / 60) - 1}:${sleepMinutes % 60}`,
        crossesMidnight: true,
      },
      createdAt: 0,
      updatedAt: 0,
    })

    if (hasAlex) {
      answers.push({
        id: `ans_social_${i}`,
        date: curDate,
        questionId: 'q_social',
        partId: 'p_social_people',
        instance: 0,
        value: ['item_alex'],
        createdAt: 0,
        updatedAt: 0,
      })
      answerLinks.push({
        id: `link_alex_${i}`,
        answerId: `ans_social_${i}`,
        date: curDate,
        libraryId: 'lib_people',
        itemId: 'item_alex',
        createdAt: 0,
        updatedAt: 0,
      })
    }

    if (hasFlying) {
      answers.push({
        id: `ans_dream_${i}`,
        date: curDate,
        questionId: 'q_dream',
        partId: 'p_dream_themes',
        instance: 0,
        value: ['item_theme_flying'],
        createdAt: 0,
        updatedAt: 0,
      })
      answerLinks.push({
        id: `link_dream_${i}`,
        answerId: `ans_dream_${i}`,
        date: curDate,
        libraryId: 'lib_themes',
        itemId: 'item_theme_flying',
        createdAt: 0,
        updatedAt: 0,
      })
    }

    if (hasNote) {
      answers.push({
        id: `ans_ref_${i}`,
        date: curDate,
        questionId: 'q_reflection',
        partId: 'p_reflection_note',
        instance: 0,
        value: 'Random evening note.',
        createdAt: 0,
        updatedAt: 0,
      })
    }
  }

  return { days, answers, questions, parts, items, answerLinks }
}

/**
 * 3. Tiny Data Dataset (TRD 7, Plan Phase 7)
 * 2 to 5 days of data.
 */
export function generateTinyDataset(daysCount = 3, seed = 123): SyntheticDataset {
  return generatePureNoiseDataset(daysCount, seed)
}
