const jiti = require('jiti')(__filename)

async function run() {
  console.log('Running Insights Engine Validation Harness...')

  const { generateInsights } = jiti('../core/engine/generator.ts')
  const {
    generatePlantedEffectsDataset,
    generatePureNoiseDataset,
    generateTinyDataset,
  } = jiti('../tools/plantedEffects.ts')

  // Test 1: Planted effects
  console.log('\n--- Test 1: Planted Effects (120 days) ---')
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

  console.log(`Insights count: ${result.insights.length}, Above bar 6.5: ${result.nAboveBar}`)
  if (result.insights.length < 20) throw new Error('Expected at least 20 insights')
  if (result.nAboveBar < 4) throw new Error('Expected at least 4 insights above bar')

  const top20Signatures = result.insights.slice(0, 20).map((i) => i.signature)
  console.log('All generated insights:')
  result.insights.forEach((i, idx) => console.log(`  ${idx + 1}. [Score ${i.score}, Sureness ${i.sureness}] ${i.signature} -> ${i.headline}`))

  // 1. Exercise -> Mood
  const exerciseInsight = result.insights.find((i) =>
    i.signature.includes('q_exercise.p_exercise_did') && i.signature.includes('q_mood.p_mood_score')
  )
  if (!exerciseInsight) throw new Error('Missing exercise -> mood insight')
  if (!top20Signatures.includes(exerciseInsight.signature)) throw new Error('Exercise insight not in top 20')
  if (exerciseInsight.sureness <= 6.0) throw new Error(`Exercise sureness expected > 6.0, got ${exerciseInsight.sureness}`)
  if (exerciseInsight.n < 90) throw new Error(`Exercise n expected >= 90, got ${exerciseInsight.n}`)
  console.log('Pass: Exercise -> Mood lift surfaced in top 20 with sureness > 6 at n >= 90')

  // 2. Steps -> Mood
  const stepsInsight = result.insights.find((i) =>
    i.signature.includes('q_steps.p_steps_val') && i.signature.includes('q_mood.p_mood_score')
  )
  if (!stepsInsight) throw new Error('Missing steps -> mood correlation')
  if (!top20Signatures.includes(stepsInsight.signature)) throw new Error('Steps insight not in top 20')
  if (stepsInsight.sureness <= 6.0) throw new Error(`Steps sureness expected > 6.0, got ${stepsInsight.sureness}`)
  console.log('Pass: Steps -> Mood correlation surfaced in top 20 with sureness > 6')

  // 3. Sleep change point or outlier
  const sleepFinding = result.insights.find((i) => i.signature.includes('q_sleep.p_sleep_dur'))
  if (!sleepFinding) throw new Error('Missing sleep finding')
  if (!top20Signatures.includes(sleepFinding.signature)) throw new Error('Sleep finding not in top 20')
  console.log('Pass: Sleep change point/outlier surfaced in top 20')

  // 4. Monday effect
  const mondayFinding = result.insights.find((i) => i.signature.includes('weekday|1|'))
  if (!mondayFinding) throw new Error('Missing Monday effect')
  if (!top20Signatures.includes(mondayFinding.signature)) throw new Error('Monday effect not in top 20')
  if (mondayFinding.direction !== 'negative') throw new Error('Expected Monday direction to be negative')
  console.log('Pass: Monday mood dip surfaced in top 20')

  // 5. Library lag
  const libraryLagFinding = result.insights.find((i) =>
    i.signature.includes('library_lag|item_alex|item_theme_flying')
  )
  if (!libraryLagFinding) throw new Error('Missing library lag finding')
  console.log('Pass: Library lag (Alex -> Flying dream) surfaced')

  // 6. Rough stretch
  const stretchFinding = result.insights.find((i) => i.signature.includes('stretch|'))
  if (!stretchFinding) throw new Error('Missing rough stretch finding')
  console.log('Pass: 4-day rough stretch surfaced')

  // Test 2: Pure noise
  console.log('\n--- Test 2: Pure Noise Dataset (120 days) ---')
  const noiseDataset = generatePureNoiseDataset(120, 999)
  const noiseResult = generateInsights({
    days: noiseDataset.days,
    answers: noiseDataset.answers,
    questions: noiseDataset.questions,
    parts: noiseDataset.parts,
    items: noiseDataset.items,
    answerLinks: noiseDataset.answerLinks,
    options: { bar: 6.5, minShow: 20 },
  })

  console.log(`Noise dataset insights above bar: ${noiseResult.nAboveBar}`)
  if (noiseResult.nAboveBar >= 2) {
    throw new Error(`Expected < 2 insights above bar 6.5, got ${noiseResult.nAboveBar}`)
  }
  const avgSureness =
    noiseResult.insights.reduce((acc, i) => acc + i.sureness, 0) / noiseResult.insights.length
  console.log(`Noise dataset average sureness: ${avgSureness.toFixed(2)}`)
  if (avgSureness >= 4.5) {
    throw new Error(`Expected average sureness < 4.5, got ${avgSureness}`)
  }
  console.log('Pass: Pure noise has < 2 insights above 6.5 and low sureness')

  // Test 3: Tiny data
  console.log('\n--- Test 3: Tiny Data (3 days) ---')
  const tinyDataset = generateTinyDataset(3, 123)
  const tinyResult = generateInsights({
    days: tinyDataset.days,
    answers: tinyDataset.answers,
    questions: tinyDataset.questions,
    parts: tinyDataset.parts,
    items: tinyDataset.items,
    answerLinks: tinyDataset.answerLinks,
    options: { bar: 6.5, minShow: 20, minN: 2 },
  })

  console.log(`Tiny dataset insights generated: ${tinyResult.insights.length}`)
  if (tinyResult.insights.length < 20) {
    throw new Error(`Expected >= 20 padded items for tiny data, got ${tinyResult.insights.length}`)
  }
  for (const ins of tinyResult.insights) {
    if (ins.sureness >= 2.0) {
      throw new Error(`Expected sureness < 2.0 for tiny data, got ${ins.sureness}`)
    }
  }
  console.log('Pass: Tiny data runs without crashing, produces >= 20 items, all with sureness < 2')

  // Test 4: Determinism & Performance budget
  console.log('\n--- Test 4: Determinism & Performance Budget (180 days) ---')
  const denseDataset = generatePlantedEffectsDataset(180, 777)

  const t0 = Date.now()
  const runA = generateInsights({
    days: denseDataset.days,
    answers: denseDataset.answers,
    questions: denseDataset.questions,
    parts: denseDataset.parts,
    items: denseDataset.items,
    answerLinks: denseDataset.answerLinks,
    options: { bar: 6.5, minShow: 20 },
  })
  const duration = Date.now() - t0

  const runB = generateInsights({
    days: denseDataset.days,
    answers: denseDataset.answers,
    questions: denseDataset.questions,
    parts: denseDataset.parts,
    items: denseDataset.items,
    answerLinks: denseDataset.answerLinks,
    options: { bar: 6.5, minShow: 20 },
  })

  console.log(`Dense run duration: ${duration} ms (budget: <= 10,000 ms)`)
  if (duration >= 10000) throw new Error(`Exceeded 10s budget: ${duration} ms`)

  if (runA.insights.length !== runB.insights.length) throw new Error('Determinism mismatch: length')
  if (runA.nAboveBar !== runB.nAboveBar) throw new Error('Determinism mismatch: nAboveBar')

  for (let i = 0; i < runA.insights.length; i++) {
    if (runA.insights[i].signature !== runB.insights[i].signature) {
      throw new Error(`Determinism signature mismatch at ${i}`)
    }
    if (runA.insights[i].score !== runB.insights[i].score) {
      throw new Error(`Determinism score mismatch at ${i}`)
    }
  }
  console.log('Pass: Execution is strictly deterministic and well under 10s budget')

  // Test 5: Discard suppression
  console.log('\n--- Test 5: Discarded Signatures Suppression ---')
  const topSig = runA.insights[0].signature
  const runSuppressed = generateInsights({
    days: denseDataset.days,
    answers: denseDataset.answers,
    questions: denseDataset.questions,
    parts: denseDataset.parts,
    items: denseDataset.items,
    answerLinks: denseDataset.answerLinks,
    options: {
      bar: 6.5,
      minShow: 20,
      discardedSignatures: [topSig],
    },
  })

  const found = runSuppressed.insights.find((i) => i.signature === topSig)
  if (found) throw new Error('Discarded signature was not suppressed!')
  console.log(`Pass: Discarded signature ${topSig} was cleanly suppressed`)

  console.log('\nALL 5 VALIDATION HARNESS TESTS PASSED SUCCESSFULLY!')
}

run().catch((err) => {
  console.error('\nTest failed:', err)
  process.exit(1)
})
