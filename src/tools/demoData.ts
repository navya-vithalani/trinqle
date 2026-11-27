import type { TrinqleDB } from '../data/db'
import { db as defaultDb } from '../data/db'
import { generateUUIDv7 } from '../core/ids'
import { addDays, logicalDate, DEFAULT_WINDOW } from '../core/logicalDay'
import { buildFrozenChapter } from '../core/freeze'
import { generateInsights } from '../core/engine/generator'
import { isQuestionVisible } from '../core/formEngine'
import { importFormPack } from '../data/formPack/importer'
import starterPack from '../content/starter-form-pack.json'
import type {
  Chapter,
  Day,
  Answer,
  AnswerLink,
  Cycle,
  ChapterAnswer,
  FormPack,
  Item,
  LibraryConfig,
  Memorability,
  NumberConfig,
  Part,
  Question,
  Run,
  Insight,
  ScaleConfig,
  Section,
  TimeRangeValue,
} from '../data/types'

function createSeededPRNG(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const SAMPLE_TITLES = [
  'Morning walk by the river',
  'Focused study afternoon',
  'Slow rainy evening',
  'Deep build sprint',
  'Quiet reading & tea',
  'Catching up with friends',
  'Fresh reset Sunday',
  'Productive problem solving',
  'Balanced work & rest',
  'Early night recharge',
]

const SAMPLE_ONELINERS = [
  'Steady rhythm across the day and calmer evening.',
  'Good morning energy, stayed consistent with habits.',
  'Felt grounded after taking a proper break.',
  'Moved through tough tasks with patience.',
  'Low noise, solid rest, clear priorities.',
]

const PHRASE_BANK = [
  'clear morning focus',
  'quiet evening walk',
  'deep focus session',
  'restorative sleep night',
  'steady afternoon rhythm',
]

const TEXT_FILLERS = [
  'Spent time reflecting on what felt sustainable today.',
  'Noticed how pacing earlier in the afternoon changed the evening mood.',
  'Kept routines simple and wrapped up screens a bit earlier.',
  'Small consistent steps added up by the end of the night.',
]

const STICKERS = ['star', 'cat-face', 'sun', 'moon', 'leaf', 'flower', 'cloud']

// Minimal valid 1x1 PNG (41+ bytes) so chapter photos survive strict magic-byte validation
const SAMPLE_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d,
  0xb0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
])

function makeDemoPhotoBlob(): Blob {
  return new Blob([SAMPLE_PNG_BYTES], { type: 'image/png' })
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}

function formatHhMm(totalMinutes: number): string {
  const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440
  const hh = Math.floor(m / 60)
  const mm = m % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export interface DemoDataOptions {
  seed?: number
  daysCount?: number
  referenceDate?: string
  mode?: 'realistic' | 'null'
  includeCycles?: boolean
}

export interface PlantedSpecSummary {
  primaryOutcomeKey: string
  secondaryOutcomeKey?: string
  positiveDriverKeys: string[]
  negativeDriverKeys: string[]
  laggedDriverKey?: string
  plantedItemIds: string[]
  plantedPhrase: string
}

export interface DemoDataResult {
  seed: number
  mode: 'realistic' | 'null'
  chaptersCount: number
  daysCount: number
  answersCount: number
  answerLinksCount: number
  cyclesCount: number
  insightsCount: number
  planted: PlantedSpecSummary
}

/**
 * Form-driven seeded journal data generator (1D).
 * Reads whatever form is currently active in `db` and generates realistic entries,
 * closed & frozen chapters with photos/reflections, cycles, and planted patterns.
 * Throws explicitly if no active form exists.
 */
export async function generateDemoData(
  db: TrinqleDB = defaultDb,
  options: DemoDataOptions = {}
): Promise<DemoDataResult> {
  const seed = options.seed ?? Math.floor(Math.random() * 900000) + 1000
  const mode: 'realistic' | 'null' = options.mode ?? 'realistic'
  const includeCycles = options.includeCycles ?? true
  const rand = createSeededPRNG(seed)

  // Load active form schema (must already be configured; never silently override user's empty state)
  const [sections, questions, parts, libraries, existingItems] = await Promise.all([
    db.sections.filter((s) => !s.deletedAt).toArray(),
    db.questions.filter((q) => !q.deletedAt).toArray(),
    db.parts.filter((p) => !p.deletedAt).toArray(),
    db.libraries.filter((l) => !l.deletedAt).toArray(),
    db.items.filter((i) => !i.deletedAt).toArray(),
  ])

  if (sections.length === 0 || questions.length === 0 || parts.length === 0) {
    throw new Error(
      'No active form is configured yet. Import a form pack or build sections first before generating demo data.'
    )
  }

  const sectionMap = new Map<string, Section>(sections.map((s) => [s.id, s]))
  const chapEndSections = new Set(sections.filter((s) => s.scope === 'chapterEnd').map((s) => s.id))

  const dailyQuestions = questions.filter(
    (q) => !chapEndSections.has(q.sectionId) && !q.schedule?.chapterEnd
  )
  const chapEndQuestions = questions.filter(
    (q) => chapEndSections.has(q.sectionId) || Boolean(q.schedule?.chapterEnd)
  )

  const dailyQIds = new Set(dailyQuestions.map((q) => q.id))
  const dailyParts = parts.filter((p) => dailyQIds.has(p.questionId))

  // Ensure every non-retired library has sample items if empty so library metrics work cleanly
  const itemsByLibrary = new Map<string, Item[]>()
  for (const it of existingItems) {
    const arr = itemsByLibrary.get(it.libraryId) || []
    arr.push(it)
    itemsByLibrary.set(it.libraryId, arr)
  }
  const createdItems: Item[] = []
  for (const lib of libraries) {
    if (!(itemsByLibrary.get(lib.id)?.length)) {
      const defaults = ['Focused', 'Outdoors', 'Relaxed']
      const arr: Item[] = []
      defaults.forEach((name, idx) => {
        const item: Item = {
          id: `demo_item_${lib.id}_${idx}`,
          libraryId: lib.id,
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        arr.push(item)
        createdItems.push(item)
      })
      itemsByLibrary.set(lib.id, arr)
    }
  }
  const allItems = [...existingItems, ...createdItems]

  // Discover candidate metrics dynamically from the active form
  const numericOutcomes = dailyParts.filter(
    (p) => (p.kind === 'scale' || p.kind === 'number') && !p.gate
  )
  const scaleFirst = [
    ...numericOutcomes.filter((p) => p.kind === 'scale'),
    ...numericOutcomes.filter((p) => p.kind === 'number'),
  ]
  const primaryOutcome = scaleFirst[0]
  const secondaryOutcome = scaleFirst.find(
    (p) => p.questionId !== primaryOutcome?.questionId
  ) ?? scaleFirst[1]

  const candidateDrivers = dailyParts.filter(
    (p) =>
      p.id !== primaryOutcome?.id &&
      p.id !== secondaryOutcome?.id &&
      (p.kind === 'yesno' || p.kind === 'number' || p.kind === 'timerange' || p.kind === 'scale')
  )
  // Prefer distinct questions for drivers so each finding is clear
  const chosenPositiveDrivers: Part[] = []
  const chosenNegativeDrivers: Part[] = []
  const usedQ = new Set<string>()
  for (const p of candidateDrivers) {
    if (usedQ.has(p.questionId)) continue
    if (chosenPositiveDrivers.length < 2) {
      chosenPositiveDrivers.push(p)
      usedQ.add(p.questionId)
    } else if (chosenNegativeDrivers.length < 2) {
      chosenNegativeDrivers.push(p)
      usedQ.add(p.questionId)
    }
  }
  const laggedDriver =
    candidateDrivers.find((p) => !usedQ.has(p.questionId)) || chosenPositiveDrivers[0]

  const libraryParts = dailyParts.filter((p) => p.kind === 'library')
  const plantedItemIds: string[] = []
  for (const lp of libraryParts.slice(0, 2)) {
    const libId = (lp.config as LibraryConfig)?.libraryId
    const libList = libId ? itemsByLibrary.get(libId) : undefined
    if (libList && libList[0]) plantedItemIds.push(libList[0].id)
  }

  const totalDays = Math.max(28, options.daysCount ?? 75)
  const refDate = options.referenceDate || logicalDate(new Date(), undefined, DEFAULT_WINDOW.endHour)
  const startDate = addDays(refDate, -totalDays + 1)

  const ch1Span = Math.min(28, Math.max(20, Math.floor(totalDays / 3)))
  const ch2Span = Math.min(28, Math.max(20, Math.floor((totalDays - ch1Span) / 2)))
  const ch1Start = startDate
  const ch1End = addDays(ch1Start, ch1Span - 1)
  const ch2Start = addDays(ch1End, 1)
  const ch2End = addDays(ch2Start, ch2Span - 1)
  const ch3Start = addDays(ch2End, 1)
  const ch3PlannedEnd = addDays(ch3Start, 27) > refDate ? addDays(ch3Start, 27) : refDate

  const baseTs = Date.UTC(
    Number(ch1Start.slice(0, 4)),
    Number(ch1Start.slice(5, 7)) - 1,
    Number(ch1Start.slice(8, 10))
  )

  const chapter1Id = generateUUIDv7(baseTs)
  const chapter2Id = generateUUIDv7(baseTs + 28 * 86400000)
  const chapter3Id = generateUUIDv7(baseTs + 56 * 86400000)

  // Generate Cycles (~28d rhythm, 5d duration)
  const cycles: Cycle[] = []
  const cycleDayByDate = new Map<string, number>()
  if (includeCycles) {
    let cCursor = addDays(ch1Start, 3)
    let cIdx = 0
    while (cCursor <= refDate && cIdx < 6) {
      const cEndCandidate = addDays(cCursor, 4)
      const isClosedCycle = cEndCandidate < addDays(refDate, -1)
      const cId = generateUUIDv7(baseTs + cIdx * 1000000 + 500)
      cycles.push({
        id: cId,
        startDate: cCursor,
        endDate: isClosedCycle ? cEndCandidate : undefined,
        createdAt: baseTs + cIdx * 86400000,
        updatedAt: baseTs + cIdx * 86400000,
      })
      const activeEnd = isClosedCycle ? cEndCandidate : refDate
      let d = cCursor
      let cDay = 1
      while (d <= activeEnd && cDay <= 10) {
        cycleDayByDate.set(d, cDay)
        d = addDays(d, 1)
        cDay++
      }
      cCursor = addDays(cCursor, 27 + Math.round(rand() * 2))
      cIdx++
    }
  }

  // Build latent daily trajectories for structured realistic signals (zero bias in null mode)
  const posSignalSeries: number[] = []
  const negSignalSeries: number[] = []
  const lagSignalSeries: number[] = []
  const phraseIdx = Math.floor(rand() * PHRASE_BANK.length)
  const plantedPhrase = PHRASE_BANK[phraseIdx]

  for (let i = 0; i < totalDays; i++) {
    if (mode === 'null') {
      posSignalSeries.push(rand() > 0.5 ? 1 : 0)
      negSignalSeries.push(rand() > 0.5 ? 1 : 0)
      lagSignalSeries.push(rand() > 0.5 ? 1 : 0)
    } else {
      const dateStr = addDays(startDate, i)
      const [y, m, d] = dateStr.split('-').map(Number)
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
      const weekendBoost = wd === 0 || wd === 6 ? 0.25 : wd === 1 ? -0.25 : 0
      const posP = clamp(0.55 + weekendBoost + 0.1 * Math.sin(i / 5), 0.15, 0.9)
      const negP = clamp(0.35 - 0.12 * weekendBoost + 0.1 * Math.cos(i / 6), 0.1, 0.85)
      posSignalSeries.push(rand() < posP ? 1 : 0)
      negSignalSeries.push(rand() < negP ? 1 : 0)
      lagSignalSeries.push(rand() < 0.45 ? 1 : 0)
    }
  }

  const days: Day[] = []
  const answers: Answer[] = []
  const answerLinks: AnswerLink[] = []

  const questionPartsMap = new Map<string, Part[]>()
  for (const p of dailyParts) {
    const arr = questionPartsMap.get(p.questionId) || []
    arr.push(p)
    questionPartsMap.set(p.questionId, arr)
  }

  const topQuestions = dailyQuestions
    .filter((q) => !q.parentId)
    .sort((a, b) => a.order - b.order)
  const subQuestionsByParent = new Map<string, Question[]>()
  for (const q of dailyQuestions) {
    if (q.parentId) {
      const arr = subQuestionsByParent.get(q.parentId) || []
      arr.push(q)
      subQuestionsByParent.set(q.parentId, arr)
    }
  }

  const positiveDriverIds = new Set(chosenPositiveDrivers.map((p) => p.id))
  const negativeDriverIds = new Set(chosenNegativeDrivers.map((p) => p.id))

  for (let i = 0; i < totalDays; i++) {
    const dateStr = addDays(startDate, i)
    const [yy, mm, dd] = dateStr.split('-').map(Number)
    const weekday = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()

    // Leave realistic skipped gaps (~7%), except ensure recent last 2 days are mostly filled
    if (i < totalDays - 2 && rand() < 0.07) continue

    const chapterId =
      dateStr <= ch1End ? chapter1Id : dateStr <= ch2End ? chapter2Id : chapter3Id
    const isCh3 = chapterId === chapter3Id
    const dayTs = baseTs + i * 86400000 + 21 * 3600000
    const cycleDay = cycleDayByDate.get(dateStr)

    const posSignal = posSignalSeries[i]
    const negSignal = negSignalSeries[i]
    const lagPrev = i > 0 ? lagSignalSeries[i - 1] : 0
    const isMonday = weekday === 1
    const isWeekend = weekday === 0 || weekday === 6

    // Composite normalized well-being factor [0..1]
    let dayFactor = rand()
    let hasPlantedTagToday = false
    if (mode === 'realistic') {
      const progressDrift = (i / Math.max(1, totalDays - 1)) * 0.16
      const wdEffect = isMonday ? -0.18 : isWeekend ? 0.14 : 0
      const cycEffect = cycleDay && cycleDay <= 4 ? -0.15 : 0
      dayFactor = clamp(
        0.46 +
          0.26 * posSignal -
          0.24 * negSignal +
          0.14 * lagPrev +
          progressDrift +
          wdEffect +
          cycEffect +
          (rand() - 0.5) * 0.18,
        0.04,
        0.98
      )
    }

    const dayAnswersList: Answer[] = []
    const isPartialDay = rand() < 0.12
    const dayFormMode: 'quick' | 'full' = isPartialDay ? 'quick' : 'full'

    const formSnap = {
      sections,
      questions: dailyQuestions,
      parts: dailyParts,
    }

    const fillPartForInstance = (
      q: Question,
      part: Part,
      instance: number,
      allowSkipExtra: boolean
    ): unknown => {
      if (allowSkipExtra && part.level === 'extra' && rand() < 0.45) {
        return undefined
      }

      let value: unknown
      const isPosDriver = positiveDriverIds.has(part.id)
      const isNegDriver = negativeDriverIds.has(part.id)
      const isLagDriver = laggedDriver?.id === part.id
      const isPrimaryOut = primaryOutcome?.id === part.id
      const isSecOut = secondaryOutcome?.id === part.id

      if (part.kind === 'yesno') {
        if (mode === 'null') {
          value = rand() < 0.55
        } else if (isPosDriver) {
          value = posSignal === 1
        } else if (isNegDriver) {
          value = negSignal === 1
        } else if (isLagDriver) {
          value = lagSignalSeries[i] === 1
        } else if (part.gate) {
          value = rand() < 0.72
        } else {
          value = rand() < clamp(0.35 + dayFactor * 0.45, 0.15, 0.9)
        }
      } else if (part.kind === 'scale') {
        const cfg = (part.config || {}) as Partial<ScaleConfig>
        const min = typeof cfg.min === 'number' ? cfg.min : 1
        const max = typeof cfg.max === 'number' ? cfg.max : 10
        const step = typeof cfg.step === 'number' && cfg.step > 0 ? cfg.step : 1
        let norm = rand()
        if (mode === 'realistic') {
          if (isPrimaryOut) {
            norm = clamp(dayFactor + (rand() - 0.5) * 0.1, 0, 1)
          } else if (isSecOut) {
            norm = clamp(0.75 * dayFactor + 0.25 * (1 - negSignal) + (rand() - 0.5) * 0.12, 0, 1)
          } else if (isPosDriver) {
            norm = posSignal ? clamp(0.75 + rand() * 0.2, 0, 1) : clamp(0.25 + rand() * 0.2, 0, 1)
          } else if (isNegDriver) {
            norm = negSignal ? clamp(0.78 + rand() * 0.2, 0, 1) : clamp(0.2 + rand() * 0.25, 0, 1)
          } else {
            norm = clamp(0.3 + dayFactor * 0.55 + (rand() - 0.5) * 0.2, 0, 1)
          }
        }
        const rawVal = min + norm * (max - min)
        value = Number((Math.round(rawVal / step) * step).toFixed(2))
        value = clamp(value as number, min, max)
      } else if (part.kind === 'number') {
        const cfg = (part.config || {}) as Partial<NumberConfig>
        const min = typeof cfg.min === 'number' ? cfg.min : 0
        const max = typeof cfg.max === 'number' ? cfg.max : 20
        const step = typeof cfg.step === 'number' && cfg.step > 0 ? cfg.step : 1
        let norm = rand()
        if (mode === 'realistic') {
          if (isPosDriver) {
            norm = posSignal ? clamp(0.65 + rand() * 0.25, 0, 1) : clamp(0.15 + rand() * 0.2, 0, 1)
          } else if (isNegDriver) {
            norm = negSignal ? clamp(0.65 + rand() * 0.25, 0, 1) : clamp(0.15 + rand() * 0.2, 0, 1)
          } else if (isLagDriver) {
            norm = lagSignalSeries[i] ? 0.72 : 0.22
          } else if (isPrimaryOut || isSecOut) {
            norm = clamp(dayFactor * 0.75 + rand() * 0.25, 0, 1)
          } else {
            norm = clamp(0.25 + dayFactor * 0.5 + (rand() - 0.5) * 0.25, 0, 1)
          }
        }
        const realisticSpan = Math.min(max, min + Math.max(step * 8, (max - min) * 0.65))
        const rawVal = min + norm * (realisticSpan - min)
        value = Number((Math.round(rawVal / step) * step).toFixed(2))
        value = clamp(value as number, min, max)
      } else if (part.kind === 'timerange') {
        const looksLikeSleep = /sleep|bed|rest/i.test(q.label + ' ' + part.label)
        if (looksLikeSleep) {
          const sleepStartMin =
            mode === 'realistic' && negSignal === 1
              ? 24 * 60 + 25 + Math.round(rand() * 45) // 00:25..01:10
              : 23 * 60 + Math.round(rand() * 45) // 23:00..23:45
          const durMin =
            mode === 'realistic'
              ? clamp(
                  Math.round(330 + dayFactor * 165 - negSignal * 45 + (rand() - 0.5) * 35),
                  270,
                  560
                )
              : Math.round(360 + rand() * 140)
          const endMin = (sleepStartMin + durMin) % 1440
          const startStr = formatHhMm(sleepStartMin)
          const endStr = formatHhMm(endMin)
          const tr: TimeRangeValue = {
            start: startStr,
            end: endStr,
            crossesMidnight: startStr > endStr,
          }
          value = tr
        } else {
          const baseStart = 9 * 60 + instance * 180 + Math.round(rand() * 60)
          const dur =
            mode === 'realistic' && isPosDriver
              ? posSignal === 1
                ? 75 + Math.round(rand() * 45)
                : 20 + Math.round(rand() * 20)
              : 35 + Math.round(rand() * 65)
          const tr: TimeRangeValue = {
            start: formatHhMm(baseStart),
            end: formatHhMm(baseStart + dur),
            crossesMidnight: false,
          }
          value = tr
        }
      } else if (part.kind === 'library') {
        const cfg = (part.config || {}) as Partial<LibraryConfig>
        const pool = cfg.libraryId ? itemsByLibrary.get(cfg.libraryId) || [] : []
        if (pool.length > 0) {
          let selected: Item[]
          if (mode === 'realistic' && posSignal === 1 && plantedItemIds.includes(pool[0].id)) {
            selected = [pool[0]]
            hasPlantedTagToday = true
          } else {
            const pick = pool[Math.floor(rand() * pool.length)]
            selected = [pick]
          }
          if (cfg.multi && pool.length > 1 && rand() < 0.35) {
            const extra = pool[Math.floor(rand() * pool.length)]
            if (!selected.some((s) => s.id === extra.id)) selected.push(extra)
          }
          value = selected.map((s) => s.id)
          for (const item of selected) {
            const ansId = generateUUIDv7(dayTs + answers.length + answerLinks.length)
            answerLinks.push({
              id: ansId,
              answerId: `${dateStr}:${part.id}:${instance}`,
              date: dateStr,
              libraryId: item.libraryId,
              itemId: item.id,
              createdAt: dayTs,
              updatedAt: dayTs,
            })
          }
        }
      } else if (part.kind === 'text') {
        if (mode === 'realistic' && (posSignal === 1 || rand() < 0.35)) {
          const prefix =
            mode === 'realistic' && posSignal === 1 && rand() < 0.65
              ? `${plantedPhrase.charAt(0).toUpperCase() + plantedPhrase.slice(1)}. `
              : ''
          const body = TEXT_FILLERS[Math.floor(rand() * TEXT_FILLERS.length)]
          value = `${prefix}${body}`
        } else if (rand() < 0.5) {
          value = TEXT_FILLERS[Math.floor(rand() * TEXT_FILLERS.length)]
        }
      }

      if (value === undefined) return undefined

      const ansId = `${dateStr}:${part.id}:${instance}`
      const ansRecord: Answer = {
        id: ansId,
        date: dateStr,
        questionId: q.id,
        partId: part.id,
        instance,
        value: value as Answer['value'],
        createdAt: dayTs,
        updatedAt: dayTs,
      }
      answers.push(ansRecord)
      dayAnswersList.push(ansRecord)
      return value
    }

    // Iterate parent questions respecting visibility, gates, repeats & sub-questions
    for (const q of topQuestions) {
      const sec = sectionMap.get(q.sectionId)
      if (!sec || !isQuestionVisible(q, formSnap, dayAnswersList, dateStr, Boolean(cycleDay), 0)) {
        continue
      }

      const qParts = (questionPartsMap.get(q.id) || []).sort((a, b) => a.order - b.order)
      if (qParts.length === 0) continue

      const gatePart = qParts.find((p) => p.gate)
      let gateOpen = true
      if (gatePart) {
        const gVal = fillPartForInstance(q, gatePart, 0, false)
        gateOpen = Boolean(gVal)
      }

      if (!gateOpen) continue

      const nonGateParts = qParts.filter((p) => !p.gate)
      const instanceCount = q.repeats ? (rand() < 0.35 ? 2 : 1) : 1

      for (let inst = 0; inst < instanceCount; inst++) {
        for (const p of nonGateParts) {
          fillPartForInstance(q, p, inst, isPartialDay)
        }

        // Fill nested sub-questions matching parent instance
        const children = subQuestionsByParent.get(q.id) || []
        for (const sq of children) {
          if (!isQuestionVisible(sq, formSnap, dayAnswersList, dateStr, Boolean(cycleDay), inst)) {
            continue
          }
          const sqParts = (questionPartsMap.get(sq.id) || []).sort((a, b) => a.order - b.order)
          const sqGate = sqParts.find((p) => p.gate)
          if (sqGate) {
            const openSq = fillPartForInstance(sq, sqGate, inst, false)
            if (!openSq) continue
          }
          for (const sp of sqParts.filter((p) => !p.gate)) {
            fillPartForInstance(sq, sp, inst, isPartialDay)
          }
        }
      }
    }

    const overallRating = clamp(
      Math.round((3.5 + dayFactor * 6.0) * 10) / 10,
      1,
      10
    )
    const memorability: Memorability =
      overallRating >= 8.7 && rand() < 0.35
        ? 3
        : overallRating >= 7.6
          ? 2
          : overallRating >= 6.0
            ? 1
            : 0

    days.push({
      date: dateStr,
      chapterId,
      title: SAMPLE_TITLES[Math.floor(rand() * SAMPLE_TITLES.length)],
      oneliner:
        mode === 'realistic' && hasPlantedTagToday
          ? `${plantedPhrase.charAt(0).toUpperCase() + plantedPhrase.slice(1)} made the difference.`
          : SAMPLE_ONELINERS[Math.floor(rand() * SAMPLE_ONELINERS.length)],
      stickerId: STICKERS[Math.floor(rand() * STICKERS.length)],
      overallRating,
      memorability,
      mode: dayFormMode,
      expandedMore: false,
      backfilled: !isCh3 && rand() < 0.1,
      filledAt: dayTs,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    })
  }

  // Chapter reflections + photos for closed chapters
  const chapterAnswers: ChapterAnswer[] = []
  const chapEndParts = parts.filter((p) =>
    chapEndQuestions.some((q) => q.id === p.questionId)
  )
  for (const chId of [chapter1Id, chapter2Id]) {
    for (const p of chapEndParts) {
      chapterAnswers.push({
        id: generateUUIDv7(baseTs + chapterAnswers.length + 100),
        chapterId: chId,
        promptId: p.id,
        value:
          p.kind === 'scale'
            ? 8
            : 'Balanced daily habits, noticed clearer links between sleep, activity, and mood.',
        createdAt: baseTs,
        updatedAt: baseTs,
      })
    }
  }

  // Run Insights Engine on full generated history so Insights tab & closed frozen chapters are immediately populated
  const analysisResult = generateInsights({
    days,
    answers,
    questions,
    parts,
    items: allItems,
    answerLinks,
    cycles,
    options: { bar: 6.5, minShow: 20, minN: 5, maxTests: 4000 },
  })

  const runTs = Date.now()
  const initialRun: Run = {
    id: generateUUIDv7(runTs),
    at: runTs,
    trigger: 'manual',
    windowLabel: 'All Time (Demo)',
    windowStart: startDate,
    windowEnd: refDate,
    nGenerated: analysisResult.insights.length,
    nAboveBar: analysisResult.nAboveBar,
    bar: 6.5,
    createdAt: runTs,
    updatedAt: runTs,
  }

  const toStoredInsights = (
    results: typeof analysisResult.insights,
    runId: string,
    windowLabel: string,
    tsBase: number
  ): Insight[] =>
    results.map((ins, idx) => ({
      id: generateUUIDv7(tsBase + idx + 1),
      runId,
      signature: ins.signature,
      windows: [windowLabel],
      payload: {
        facts: ins.facts.length > 0 ? ins.facts : [ins.headline],
        evidenceDays: ins.evidenceDays.map((e) => ({
          date: e.date,
          title: e.title,
          oneliner: e.oneliner,
        })),
      },
      sureness: ins.sureness,
      surprise: ins.surprise,
      score: ins.score,
      status: 'active',
      createdAt: tsBase + idx + 1,
      updatedAt: tsBase + idx + 1,
    }))

  const storedInsights = toStoredInsights(
    analysisResult.insights.slice(0, 30),
    initialRun.id,
    analysisResult.windowLabel || 'All Time (Demo)',
    runTs
  )

  const ch1Days = days.filter((d) => d.date >= ch1Start && d.date <= ch1End)
  const ch1Dates = new Set(ch1Days.map((d) => d.date))
  const ch1Answers = answers.filter((a) => ch1Dates.has(a.date))
  const ch1Links = answerLinks.filter((l) => ch1Dates.has(l.date))

  const ch2Days = days.filter((d) => d.date >= ch2Start && d.date <= ch2End)
  const ch2Dates = new Set(ch2Days.map((d) => d.date))
  const ch2Answers = answers.filter((a) => ch2Dates.has(a.date))
  const ch2Links = answerLinks.filter((l) => ch2Dates.has(l.date))

  const chapter1Base: Chapter = {
    id: chapter1Id,
    title: 'Chapter 1: Foundations',
    summary: 'Establishing steady daily rhythms, reflections, and baseline metrics.',
    startDate: ch1Start,
    plannedEndDate: ch1End,
    endDate: ch1End,
    status: 'closed',
    themeId: 'cutesy',
    characterId: 'white-cat',
    photos: [makeDemoPhotoBlob()],
    closedAt: new Date(ch1End).getTime() + 3600000,
    createdAt: baseTs,
    updatedAt: baseTs,
  }
  const ch1Insights = generateInsights({
    days: ch1Days,
    answers: ch1Answers,
    questions,
    parts,
    items: allItems,
    answerLinks: ch1Links,
    cycles,
    options: { bar: 6.5, minShow: 15, minN: 5, maxTests: 1500 },
  })
  chapter1Base.frozen = buildFrozenChapter({
    chapter: chapter1Base,
    days: ch1Days,
    answers: ch1Answers,
    answerLinks: ch1Links,
    sections,
    questions,
    parts,
    libraries,
    items: allItems,
    insights: toStoredInsights(ch1Insights.insights.slice(0, 12), initialRun.id, 'Chapter 1', runTs + 100),
  })

  const chapter2Base: Chapter = {
    id: chapter2Id,
    title: 'Chapter 2: Momentum',
    summary: 'Tracking deep focus, sleep quality, and habits across a full cycle.',
    startDate: ch2Start,
    plannedEndDate: ch2End,
    endDate: ch2End,
    status: 'closed',
    themeId: 'clay',
    characterId: 'cookie-man',
    photos: [makeDemoPhotoBlob()],
    closedAt: new Date(ch2End).getTime() + 3600000,
    createdAt: baseTs + 28 * 86400000,
    updatedAt: baseTs + 28 * 86400000,
  }
  const ch2Insights = generateInsights({
    days: ch2Days,
    answers: ch2Answers,
    questions,
    parts,
    items: allItems,
    answerLinks: ch2Links,
    cycles,
    options: { bar: 6.5, minShow: 15, minN: 5, maxTests: 1500 },
  })
  chapter2Base.frozen = buildFrozenChapter({
    chapter: chapter2Base,
    days: ch2Days,
    answers: ch2Answers,
    answerLinks: ch2Links,
    sections,
    questions,
    parts,
    libraries,
    items: allItems,
    insights: toStoredInsights(ch2Insights.insights.slice(0, 12), initialRun.id, 'Chapter 2', runTs + 200),
  })

  const chapter3: Chapter = {
    id: chapter3Id,
    title: 'Chapter 3: Current Journey',
    startDate: ch3Start,
    plannedEndDate: ch3PlannedEnd,
    status: 'open',
    themeId: 'cutesy',
    characterId: 'white-cat',
    createdAt: baseTs + 56 * 86400000,
    updatedAt: baseTs + 56 * 86400000,
  }

  // Persist atomically inside a transaction preserving active form schema
  await db.runBypassingClosedGuard(() =>
    db.transaction(
      'rw',
      [
        db.items,
        db.chapters,
        db.days,
        db.answers,
        db.answerLinks,
        db.cycles,
        db.chapterAnswers,
        db.runs,
        db.insights,
      ],
      async () => {
        await Promise.all([
          db.chapters.clear(),
          db.days.clear(),
          db.answers.clear(),
          db.answerLinks.clear(),
          db.cycles.clear(),
          db.chapterAnswers.clear(),
          db.runs.clear(),
          db.insights.clear(),
        ])

        if (createdItems.length > 0) await db.items.bulkPut(createdItems)
        await db.chapters.bulkPut([chapter1Base, chapter2Base, chapter3])
        if (days.length > 0) await db.days.bulkPut(days)
        if (answers.length > 0) await db.answers.bulkPut(answers)
        if (answerLinks.length > 0) await db.answerLinks.bulkPut(answerLinks)
        if (cycles.length > 0) await db.cycles.bulkPut(cycles)
        if (chapterAnswers.length > 0) await db.chapterAnswers.bulkPut(chapterAnswers)
        await db.runs.put(initialRun)
        if (storedInsights.length > 0) await db.insights.bulkPut(storedInsights)
      }
    )
  )

  return {
    seed,
    mode,
    chaptersCount: 3,
    daysCount: days.length,
    answersCount: answers.length,
    answerLinksCount: answerLinks.length,
    cyclesCount: cycles.length,
    insightsCount: storedInsights.length,
    planted: {
      primaryOutcomeKey: primaryOutcome
        ? `${primaryOutcome.questionId}.${primaryOutcome.id}`
        : 'day.overallRating',
      secondaryOutcomeKey: secondaryOutcome
        ? `${secondaryOutcome.questionId}.${secondaryOutcome.id}`
        : undefined,
      positiveDriverKeys: chosenPositiveDrivers.map((p) => `${p.questionId}.${p.id}`),
      negativeDriverKeys: chosenNegativeDrivers.map((p) => `${p.questionId}.${p.id}`),
      laggedDriverKey: laggedDriver ? `${laggedDriver.questionId}.${laggedDriver.id}` : undefined,
      plantedItemIds,
      plantedPhrase,
    },
  }
}

/**
 * Single-click helper for empty installations:
 * Imports the starter form pack and seeds a rich multi-chapter demo dataset.
 */
export async function seedFreshDemoExperience(
  db: TrinqleDB = defaultDb,
  seed = 2026
): Promise<DemoDataResult> {
  await importFormPack(starterPack as unknown as FormPack, 'replace', db)
  return generateDemoData(db, { seed, mode: 'realistic' })
}
