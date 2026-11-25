const jiti = require('jiti')(__filename)

async function runAll() {
  console.log('========================================')
  console.log('   TRINQLE AUTOMATED TEST SUITE        ')
  console.log('========================================\n')

  try {
    // 1. Metrics Tests
    console.log('>> Running Phase 5 (Metrics & Dashboard) Tests...')
    await require('./run_metrics_test.cjs')

    // 2. Archive Tests
    console.log('\n>> Running Phase 6 (Archive, Zip & Freeze) Tests...')
    await require('./run_archive_test.cjs')

    // 3. Insights Engine Tests
    console.log('\n>> Running Phase 7 (Insights Engine Validation Harness) Tests...')
    await require('./run_insights_test.cjs')

    // 4. Notifications & Push System Tests
    console.log('\n>> Running Phase 8 (VAPID Push, Scheduler & Privacy) Tests...')
    await require('./run_notifications_test.cjs')

    console.log('\n========================================')
    console.log('   ALL PHASES 5-8 TESTS PASSED!        ')
    console.log('========================================')
  } catch (err) {
    console.error('\nSuite failure:', err)
    process.exit(1)
  }
}

runAll()
