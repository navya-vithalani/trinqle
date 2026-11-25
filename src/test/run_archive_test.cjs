const jiti = require('jiti')(__filename)

async function run() {
  console.log('Running Archive & Freeze Unit Tests...')
  const { buildFrozenChapter } = jiti('../core/freeze.ts')
  const { createZipArchive, readZipArchive } = jiti('../core/zip.ts')

  // 1. Frozen Chapter
  console.log('\n--- Test 1: Freeze Chapter ---')
  const mockChapter = {
    id: 'ch_test',
    startDate: '2026-06-01',
    plannedEndDate: '2026-06-28',
    status: 'closed',
    themeId: 'cutesy',
    characterId: 'white-cat',
    createdAt: 100,
    updatedAt: 100,
  }
  const frozen = buildFrozenChapter({
    chapter: mockChapter,
    days: [],
    answers: [],
    sections: [],
    questions: [],
    parts: [],
    libraries: [],
  })
  if (!frozen) throw new Error('Frozen chapter build failed')
  if (frozen.themeId !== 'cutesy') throw new Error('themeId mismatch')
  if (!Array.isArray(frozen.dashboard)) throw new Error('dashboard is not an array')
  console.log('Pass: Frozen chapter built with formSnapshot, dashboard, and stats')

  // 2. Zip Round Trip
  console.log('\n--- Test 2: Zip Round Trip ---')
  const files = [
    { name: 'manifest.json', content: '{"version":1}' },
    { name: 'data/test.txt', content: 'Hello Trinqle Archive' },
  ]
  const zipBytes = await createZipArchive(files)
  const decoded = await readZipArchive(zipBytes)
  if (decoded.length !== 2) throw new Error(`Expected 2 files, decoded ${decoded.length}`)
  const testTxt = decoded.find((f) => f.name === 'data/test.txt')
  if (!testTxt) throw new Error('Missing data/test.txt in archive')
  const textContent = testTxt.text()
  if (textContent !== 'Hello Trinqle Archive') throw new Error(`Mismatch: ${textContent}`)
  console.log('Pass: Zip round-trip encoded and decoded cleanly')

  console.log('\nALL ARCHIVE TESTS PASSED SUCCESSFULLY!')
}

run().catch((err) => {
  console.error('\nArchive test failed:', err)
  process.exit(1)
})
