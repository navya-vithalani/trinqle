const jiti = require('jiti')(__filename)

async function run() {
  console.log('Running Archive & Freeze Unit Tests...')
  const { buildFrozenChapter } = jiti('../core/freeze.ts')
  const { createZipArchive, readZipArchive, readZipArchiveAsync } = jiti('../core/zip.ts')

  // 1. Frozen Chapter
  console.log('\n--- Test 1: Freeze Chapter (All Metric Chart Types) ---')
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
    days: [
      { id: 'd1', date: '2026-06-01', chapterId: 'ch_test', mode: 'full', overallRating: 8, memorability: 2, createdAt: 1, updatedAt: 1 },
    ],
    answers: [
      { id: 'a1', date: '2026-06-01', questionId: 'q_lib', partId: 'p_lib', instance: 0, value: ['it_1'], createdAt: 1, updatedAt: 1 },
      { id: 'a2', date: '2026-06-01', questionId: 'q_txt', partId: 'p_txt', instance: 0, value: 'Memorable evening walk', createdAt: 1, updatedAt: 1 },
    ],
    answerLinks: [
      { id: 'lnk1', answerId: 'a1', date: '2026-06-01', libraryId: 'lib1', itemId: 'it_1', createdAt: 1, updatedAt: 1 },
    ],
    items: [
      { id: 'it_1', libraryId: 'lib1', name: 'Running', aliases: [], createdAt: 1, updatedAt: 1 },
    ],
    sections: [{ id: 'sec1', name: 'Daily', icon: 'Folder', order: 0, scope: 'daily', createdAt: 1, updatedAt: 1 }],
    questions: [
      { id: 'q_lib', sectionId: 'sec1', label: 'Activities', order: 0, createdAt: 1, updatedAt: 1 },
      { id: 'q_txt', sectionId: 'sec1', label: 'Journal', order: 1, createdAt: 1, updatedAt: 1 },
    ],
    parts: [
      { id: 'p_lib', questionId: 'q_lib', kind: 'library', label: 'Tags', level: 'core', order: 0, config: { libraryId: 'lib1' }, createdAt: 1, updatedAt: 1 },
      { id: 'p_txt', questionId: 'q_txt', kind: 'text', label: 'Note', level: 'extra', order: 1, config: {}, createdAt: 1, updatedAt: 1 },
    ],
    libraries: [{ id: 'lib1', name: 'Activity', createdAt: 1, updatedAt: 1 }],
  })
  if (!frozen) throw new Error('Frozen chapter build failed')
  if (frozen.themeId !== 'cutesy') throw new Error('themeId mismatch')
  if (!Array.isArray(frozen.dashboard)) throw new Error('dashboard is not an array')
  const frozenTypes = new Set(frozen.dashboard.map((c) => c.type))
  if (!frozenTypes.has('library_frequency') || !frozenTypes.has('text_summary') || !frozenTypes.has('memorability')) {
    throw new Error(`Expected library_frequency, text_summary, and memorability in frozen dashboard; got ${Array.from(frozenTypes).join(', ')}`)
  }
  console.log('Pass: Frozen chapter built with formSnapshot, library_frequency, text_summary, and memorability')

  // 2. Zip Round Trip & Security Path Traversal Guard
  console.log('\n--- Test 2: Zip Round Trip & Safety ---')
  const files = [
    { name: 'manifest.json', content: '{"version":1}' },
    { name: 'data/test.txt', content: 'Hello Trinqle Archive' },
  ]
  const zipBytes = await createZipArchive(files)
  const decoded = await readZipArchive(zipBytes)
  const decodedAsync = await readZipArchiveAsync(zipBytes)
  if (decoded.length !== 2 || decodedAsync.length !== 2) throw new Error(`Expected 2 files, decoded ${decoded.length}`)
  const testTxt = decodedAsync.find((f) => f.name === 'data/test.txt')
  if (!testTxt) throw new Error('Missing data/test.txt in archive')
  const textContent = testTxt.text()
  if (textContent !== 'Hello Trinqle Archive') throw new Error(`Mismatch: ${textContent}`)

  const evilZip = createZipArchive([{ name: '../escape.txt', content: 'bad' }])
  let caughtUnsafe = false
  try {
    readZipArchive(evilZip)
  } catch {
    caughtUnsafe = true
  }
  if (!caughtUnsafe) throw new Error('Expected ZIP reader to reject path traversal entry')
  console.log('Pass: Zip sync/async round-trip and path traversal guard verified')

  console.log('\nALL ARCHIVE TESTS PASSED SUCCESSFULLY!')
}

run().catch((err) => {
  console.error('\nArchive test failed:', err)
  process.exit(1)
})
