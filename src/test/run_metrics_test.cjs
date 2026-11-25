const jiti = require('jiti')(__filename)

async function run() {
  console.log('Running Metrics Unit Tests...')
  const { splitTimeRangeIntoHourBins, calculateStreak, calculateScaleNumberStats } = jiti('../core/metrics/calculator.ts')

  // 1. Midnight wrapping
  console.log('\n--- Test 1: Midnight Wrapping Hour Bins ---')
  const bins = splitTimeRangeIntoHourBins('23:00', '01:00', true)
  if (bins.length !== 24) throw new Error('Expected 24 bins')
  if (bins[23] !== 60) throw new Error(`Bin 23 expected 60, got ${bins[23]}`)
  if (bins[0] !== 60) throw new Error(`Bin 0 expected 60, got ${bins[0]}`)
  console.log('Pass: Midnight wrapping correctly split into 23:00 and 00:00')

  // 2. Streak with skipped day bridging
  console.log('\n--- Test 2: Streak Gap Bridging ---')
  const history = [
    { date: '2026-06-01', done: true },
    { date: '2026-06-02', isSkipped: true },
    { date: '2026-06-03', done: true },
  ]
  const streak = calculateStreak(history)
  if (streak.totalDone !== 2) throw new Error(`Expected totalDone 2, got ${streak.totalDone}`)
  if (streak.currentStreak !== 2) throw new Error(`Expected currentStreak 2, got ${streak.currentStreak}`)
  console.log('Pass: Streak bridged skipped day (totalDone: 2, streak: 2)')

  console.log('\nALL METRICS TESTS PASSED SUCCESSFULLY!')
}

run().catch((err) => {
  console.error('\nMetrics test failed:', err)
  process.exit(1)
})
