import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { generateDemoData, seedFreshDemoExperience } from '../tools/demoData'
import { TrinqleDB } from '../data/db'
import { importFormPack } from '../data/formPack/importer'
import { validateFormPack } from '../data/formPack/validator'
import { generateInsights } from '../core/engine/generator'
import type { FormPack } from '../data/types'
import analyticPackRaw from '../content/analytic-form-pack.json'

async function collectAnalysisForDb(db: TrinqleDB) {
  const [days, answers, questions, parts, items, answerLinks, cycles] = await Promise.all([
    db.days.filter((d) => !d.deletedAt).toArray(),
    db.answers.filter((a) => !a.deletedAt).toArray(),
    db.questions.filter((q) => !q.deletedAt).toArray(),
    db.parts.filter((p) => !p.deletedAt).toArray(),
    db.items.filter((i) => !i.deletedAt).toArray(),
    db.answerLinks.filter((l) => !l.deletedAt).toArray(),
    db.cycles.filter((c) => !c.deletedAt).toArray(),
  ])
  return generateInsights({
    days,
    answers,
    questions,
    parts,
    items,
    answerLinks,
    cycles,
    options: { bar: 6.5, minShow: 20, minN: 5 },
  })
}

describe('Form-Driven Seeded Demo Data Generator (1D)', () => {
  let db: TrinqleDB

  beforeEach(() => {
    db = new TrinqleDB('test_demodata_' + Math.random().toString(36).slice(2))
  })

  it('throws an explicit error when no active form is configured', async () => {
    await db.open()
    await expect(generateDemoData(db, { seed: 42 })).rejects.toThrow(/No active form/i)
  })

  it('generates rich realistic history on the starter pack with frozen chapters and recoverable effects', async () => {
    const stats = await seedFreshDemoExperience(db, 42)
    expect(stats.chaptersCount).toBe(3)
    expect(stats.daysCount).toBeGreaterThan(60)
    expect(stats.cyclesCount).toBeGreaterThanOrEqual(2)
    expect(stats.insightsCount).toBeGreaterThan(0)

    const chapters = await db.chapters.orderBy('startDate').toArray()
    expect(chapters).toHaveLength(3)
    expect(chapters[0].status).toBe('closed')
    expect(chapters[0].frozen?.dashboard.length).toBeGreaterThan(0)
    expect(chapters[0].photos?.length).toBeGreaterThanOrEqual(1)
    expect(chapters[1].status).toBe('closed')
    expect(chapters[1].frozen).toBeDefined()
    expect(chapters[2].status).toBe('open')

    const analysis = await collectAnalysisForDb(db)
    expect(analysis.nAboveBar).toBeGreaterThanOrEqual(2)
    expect(analysis.insights[0].sureness).toBeGreaterThan(6)
  }, 30_000)

  it('validates analytic-form-pack.json and recovers planted findings on it', async () => {
    const validation = validateFormPack(analyticPackRaw)
    expect(validation.valid, `Analytic pack errors: ${validation.errors.join('; ')}`).toBe(true)

    await importFormPack(analyticPackRaw as unknown as FormPack, 'replace', db)
    const stats = await generateDemoData(db, {
      seed: 1337,
      daysCount: 90,
      referenceDate: '2026-10-25',
      mode: 'realistic',
    })

    expect(stats.chaptersCount).toBe(3)
    expect(stats.planted.positiveDriverKeys.length).toBeGreaterThan(0)

    const analysis = await collectAnalysisForDb(db)
    expect(analysis.nAboveBar).toBeGreaterThanOrEqual(2)
  }, 15_000)

  it('respects a custom synthetic form (gates & midnight time ranges) and stays quiet on null runs', async () => {
    const customPack: FormPack = {
      formatVersion: 1,
      kind: 'form-pack',
      name: 'Custom Compact Form',
      libraries: [{ id: 'lib_c', name: 'Tags', items: ['Alpha', 'Beta', 'Gamma'] }],
      sections: [{ id: 'sec_c', name: 'Custom', icon: 'star', order: 1, scope: 'daily' }],
      questions: [
        {
          id: 'q_custom_sleep',
          sectionId: 'sec_c',
          label: 'Night sleep',
          order: 1,
          repeats: false,
          parts: [
            {
              id: 'p_custom_tr',
              kind: 'timerange',
              label: 'Sleep window',
              order: 1,
              level: 'core',
              config: { snapMinutes: 5 },
            },
          ],
        },
        {
          id: 'q_custom_habit',
          sectionId: 'sec_c',
          label: 'Custom Habit',
          order: 2,
          repeats: false,
          parts: [
            {
              id: 'p_custom_gate',
              kind: 'yesno',
              label: 'Did custom habit?',
              order: 1,
              level: 'core',
              gate: true,
              config: {},
            },
            {
              id: 'p_custom_tag',
              kind: 'library',
              label: 'Tag',
              order: 2,
              level: 'core',
              config: { libraryId: 'lib_c', multi: false, creatable: true },
            },
          ],
        },
        {
          id: 'q_custom_mood',
          sectionId: 'sec_c',
          label: 'Custom Mood',
          order: 3,
          repeats: false,
          parts: [
            {
              id: 'p_custom_scale',
              kind: 'scale',
              label: 'Score',
              order: 1,
              level: 'core',
              config: { min: 1, max: 10, step: 1, display: 'slider' },
            },
          ],
        },
      ],
    }

    await importFormPack(customPack, 'replace', db)
    await generateDemoData(db, {
      seed: 777,
      daysCount: 90,
      referenceDate: '2026-10-25',
      mode: 'realistic',
    })

    // Verify gate integrity: whenever p_custom_gate === false, p_custom_tag must NOT exist
    const answers = await db.answers.toArray()
    const falseGateDates = new Set(
      answers.filter((a) => a.partId === 'p_custom_gate' && a.value === false).map((a) => a.date)
    )
    expect(falseGateDates.size).toBeGreaterThan(0)
    const leakedTags = answers.filter((a) => a.partId === 'p_custom_tag' && falseGateDates.has(a.date))
    expect(leakedTags).toHaveLength(0)

    const realisticAnalysis = await collectAnalysisForDb(db)
    expect(realisticAnalysis.nAboveBar).toBeGreaterThanOrEqual(1)

    // Null run with zero planted biases should stay quiet
    await generateDemoData(db, {
      seed: 999,
      daysCount: 90,
      referenceDate: '2026-10-25',
      mode: 'null',
      includeCycles: false,
    })
    const nullAnalysis = await collectAnalysisForDb(db)
    expect(nullAnalysis.nAboveBar).toBeLessThanOrEqual(2)
  }, 15_000)
})
