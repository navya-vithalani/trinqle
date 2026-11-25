import { describe, it, expect } from 'vitest'
import { generateInsights } from '../core/engine/generator'
import {
  generatePlantedEffectsDataset,
  generatePureNoiseDataset,
  generateTinyDataset,
} from '../tools/plantedEffects'

describe('Phase 7: Insights Engine Validation Harness', () => {
  it('1. Planted Effects: Surfaces planted correlations with sureness > 6 at n >= 90', () => {
    const dataset = generatePlantedEffectsDataset(120, 42)
    const result = generateInsights({
      days: dataset.days,
      answers: dataset.answers,
      questions: dataset.questions,
      parts: dataset.parts,
      items: dataset.items,
      answerLinks: dataset.answerLinks,
      options: { bar: 6.5, minShow: 20 },
    })

    expect(result.insights.length).toBeGreaterThanOrEqual(20)
    expect(result.nAboveBar).toBeGreaterThanOrEqual(4)

    // Check that key planted findings appear in the top 20:
    const top20Signatures = result.insights.slice(0, 20).map((i) => i.signature)

    // 1. Exercise -> Mood lift
    const exerciseInsight = result.insights.find((i) =>
      i.signature.includes('q_exercise.p_exercise_did') && i.signature.includes('q_mood.p_mood_score')
    )
    expect(exerciseInsight).toBeDefined()
    expect(top20Signatures).toContain(exerciseInsight!.signature)
    expect(exerciseInsight!.sureness).toBeGreaterThan(6.0)
    expect(exerciseInsight!.n).toBeGreaterThanOrEqual(90)
    expect(exerciseInsight!.direction).toBe('positive')

    // 2. Steps -> Mood correlation
    const stepsInsight = result.insights.find((i) =>
      i.signature.includes('q_steps.p_steps_val') && i.signature.includes('q_mood.p_mood_score')
    )
    expect(stepsInsight).toBeDefined()
    expect(top20Signatures).toContain(stepsInsight!.signature)
    expect(stepsInsight!.sureness).toBeGreaterThan(6.0)
    expect(stepsInsight!.n).toBeGreaterThanOrEqual(90)

    // 3. Sleep change point or outlier
    const sleepFinding = result.insights.find((i) =>
      i.signature.includes('q_sleep.p_sleep_dur')
    )
    expect(sleepFinding).toBeDefined()
    expect(top20Signatures).toContain(sleepFinding!.signature)

    // 4. Monday mood effect
    const mondayFinding = result.insights.find((i) =>
      i.signature.includes('weekday|1|')
    )
    expect(mondayFinding).toBeDefined()
    expect(top20Signatures).toContain(mondayFinding!.signature)
    expect(mondayFinding!.direction).toBe('negative')

    // 5. Library lag: Alex -> Flying dream
    const libraryLagFinding = result.insights.find((i) =>
      i.signature.includes('library_lag|item_alex|item_theme_flying')
    )
    expect(libraryLagFinding).toBeDefined()

    // 6. Rough stretch finding
    const stretchFinding = result.insights.find((i) =>
      i.signature.includes('stretch|')
    )
    expect(stretchFinding).toBeDefined()

    // Compositional phrasing checks
    for (const ins of result.insights.slice(0, 5)) {
      expect(ins.headline).toBeTruthy()
      expect(ins.facts.length).toBeGreaterThan(0)
      expect(ins.score).toBeGreaterThan(0)
    }
  })

  it('2. Pure Noise: Fewer than 2 insights exceed bar 6.5; sureness is low', () => {
    const dataset = generatePureNoiseDataset(120, 999)
    const result = generateInsights({
      days: dataset.days,
      answers: dataset.answers,
      questions: dataset.questions,
      parts: dataset.parts,
      items: dataset.items,
      answerLinks: dataset.answerLinks,
      options: { bar: 6.5, minShow: 20 },
    })

    // Plan Phase 7 requirement: Fewer than 2 insights may exceed score 6.5
    expect(result.nAboveBar).toBeLessThan(2)

    // Average sureness in noise should be low
    const avgSureness =
      result.insights.reduce((acc, i) => acc + i.sureness, 0) / result.insights.length
    expect(avgSureness).toBeLessThan(4.5)
  })

  it('3. Tiny Data (2 to 5 days): Runs without crashing, produces >= 20 items with sureness < 2', () => {
    const dataset = generateTinyDataset(3, 123)
    const result = generateInsights({
      days: dataset.days,
      answers: dataset.answers,
      questions: dataset.questions,
      parts: dataset.parts,
      items: dataset.items,
      answerLinks: dataset.answerLinks,
      options: { bar: 6.5, minShow: 20, minN: 2 },
    })

    // Runs without crashing
    expect(result).toBeDefined()
    // Padded to >= 20 items
    expect(result.insights.length).toBeGreaterThanOrEqual(20)

    // Plan Phase 7 requirement: all with sureness < 2
    for (const ins of result.insights) {
      expect(ins.sureness).toBeLessThan(2.0)
    }
  })

  it('4. Determinism & Performance Budget: Identical output and budget <= 10s', () => {
    const dataset = generatePlantedEffectsDataset(180, 777)

    const t0 = performance.now()
    const runA = generateInsights({
      days: dataset.days,
      answers: dataset.answers,
      questions: dataset.questions,
      parts: dataset.parts,
      items: dataset.items,
      answerLinks: dataset.answerLinks,
      options: { bar: 6.5, minShow: 20 },
    })
    const duration = performance.now() - t0

    const runB = generateInsights({
      days: dataset.days,
      answers: dataset.answers,
      questions: dataset.questions,
      parts: dataset.parts,
      items: dataset.items,
      answerLinks: dataset.answerLinks,
      options: { bar: 6.5, minShow: 20 },
    })

    // Budget: <= 10s (10,000ms) on 6 months of data
    expect(duration).toBeLessThan(10000)

    // Deterministic check: exact identical ordering and signatures
    expect(runA.insights.length).toBe(runB.insights.length)
    expect(runA.nAboveBar).toBe(runB.nAboveBar)
    for (let i = 0; i < runA.insights.length; i++) {
      expect(runA.insights[i].signature).toBe(runB.insights[i].signature)
      expect(runA.insights[i].score).toBe(runB.insights[i].score)
      expect(runA.insights[i].sureness).toBe(runB.insights[i].sureness)
    }
  })

  it('5. Discarded signatures suppression', () => {
    const dataset = generatePlantedEffectsDataset(120, 42)
    const initialRun = generateInsights({
      days: dataset.days,
      answers: dataset.answers,
      questions: dataset.questions,
      parts: dataset.parts,
      items: dataset.items,
      answerLinks: dataset.answerLinks,
    })

    const topSignature = initialRun.insights[0].signature
    expect(topSignature).toBeTruthy()

    // Second run with topSignature discarded
    const suppressedRun = generateInsights({
      days: dataset.days,
      answers: dataset.answers,
      questions: dataset.questions,
      parts: dataset.parts,
      items: dataset.items,
      answerLinks: dataset.answerLinks,
      options: {
        discardedSignatures: [topSignature],
      },
    })

    const found = suppressedRun.insights.find((i) => i.signature === topSignature)
    expect(found).toBeUndefined()
  })
})
