import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { TrinqleDB } from '../data/db'
import { deleteAllData } from '../data/reset'
import {
  exportFullBackupZip,
  getBackupStatus,
  importFullBackupZip,
} from '../core/fullBackup'
import { downloadOrShareFile } from '../core/export'
import {
  SnapshotsDB,
  createSafetySnapshot,
  listSafetySnapshots,
  restoreSafetySnapshot,
  MAX_SAFETY_SNAPSHOTS,
} from '../core/snapshots'
import {
  runDataHealthCheck,
  fixDuplicateRecords,
  fixOrphanedAnswers,
} from '../core/healthCheck'
import type { Chapter } from '../data/types'

function makeFakeJpegBlob(): Blob {
  // Valid JPEG SOI + APP0 header bytes
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9])
  return new Blob([bytes], { type: 'image/jpeg' })
}

async function seedRichDatabase(db: TrinqleDB) {
  await db.runBypassingClosedGuard(async () => {
    await db.sections.put({
      id: 'sec_1',
      name: 'Daily Pulse',
      icon: 'sparkles',
      order: 0,
      scope: 'daily',
      createdAt: 1000,
      updatedAt: 1000,
    })
    await db.questions.put({
      id: 'q_mood',
      sectionId: 'sec_1',
      label: 'How did today feel?',
      order: 0,
      repeats: false,
      createdAt: 1000,
      updatedAt: 1000,
    })
    await db.parts.put({
      id: 'p_mood_scale',
      questionId: 'q_mood',
      kind: 'scale',
      label: 'Energy',
      order: 0,
      level: 'core',
      config: { min: 1, max: 10, step: 1 },
      createdAt: 1000,
      updatedAt: 1000,
    })
    await db.libraries.put({
      id: 'lib_tags',
      name: 'Activities',
      createdAt: 1000,
      updatedAt: 1000,
    })
    await db.items.put({
      id: 'item_run',
      libraryId: 'lib_tags',
      name: 'Running',
      createdAt: 1000,
      updatedAt: 1000,
    })

    const closedChapter: Chapter = {
      id: 'ch_closed',
      title: 'Spring Chapter',
      startDate: '2026-10-01',
      plannedEndDate: '2026-10-25',
      endDate: '2026-10-25',
      status: 'closed',
      summary: 'A memorable spring',
      photos: [makeFakeJpegBlob()],
      frozen: {
        formSnapshot: {
          sections: [],
          questions: [],
          parts: [],
          libraries: [],
        },
        dashboard: [
          {
            chartId: 'chart_mem',
            type: 'bar',
            series: [],
            rendererVersion: 1,
          },
        ],
        insights: [],
        themeId: 'cutesy',
        characterId: 'white-cat',
        metadata: {
          daysFilled: 1,
          quickCount: 0,
          fullCount: 1,
          memorableCount: 1,
        },
      },
      themeId: 'cutesy',
      characterId: 'white-cat',
      createdAt: 1000,
      updatedAt: 2000,
    }
    const openChapter: Chapter = {
      id: 'ch_open',
      title: 'Current Chapter',
      startDate: '2026-10-26',
      plannedEndDate: '2026-11-25',
      status: 'open',
      themeId: 'cutesy',
      characterId: 'white-cat',
      createdAt: 2000,
      updatedAt: 2000,
    }
    await db.chapters.bulkPut([closedChapter, openChapter])

    await db.days.bulkPut([
      {
        date: '2026-10-05',
        chapterId: 'ch_closed',
        title: 'Trail Run',
        overallRating: 8,
        memorability: 2,
        mode: 'full',
        expandedMore: false,
        backfilled: false,
        filledAt: 5000,
        tz: 'UTC',
      },
      {
        date: '2026-10-27',
        chapterId: 'ch_open',
        title: 'Fresh Start',
        overallRating: 9,
        memorability: 3,
        mode: 'full',
        expandedMore: false,
        backfilled: false,
        filledAt: 8000,
        tz: 'UTC',
      },
    ])

    await db.answers.put({
      id: 'ans_1',
      date: '2026-10-27',
      questionId: 'q_mood',
      partId: 'p_mood_scale',
      instance: 0,
      value: 8,
      createdAt: 8000,
      updatedAt: 8000,
    })
    await db.answerLinks.put({
      id: 'lnk_1',
      answerId: 'ans_1',
      date: '2026-10-27',
      libraryId: 'lib_tags',
      itemId: 'item_run',
      createdAt: 8000,
      updatedAt: 8000,
    })
    await db.chapterAnswers.put({
      id: 'ca_1',
      chapterId: 'ch_closed',
      promptId: 'pr_1',
      value: 'Learned consistency.',
      createdAt: 2000,
      updatedAt: 2000,
    })
    await db.cycles.put({
      id: 'cyc_1',
      startDate: '2026-10-10',
      endDate: '2026-10-14',
      createdAt: 1500,
      updatedAt: 1500,
    })
    await db.runs.put({
      id: 'run_1',
      at: 9000,
      trigger: 'manual',
      windowLabel: '28d',
      windowStart: '2026-10-01',
      windowEnd: '2026-10-27',
      nGenerated: 1,
      nAboveBar: 1,
      bar: 5.0,
      createdAt: 9000,
      updatedAt: 9000,
    })
    await db.insights.put({
      id: 'ins_1',
      runId: 'run_1',
      signature: 'sig_run_energy',
      windows: ['28d'],
      payload: {
        facts: ['+2.0 average energy on running days'],
        evidenceDays: [{ date: '2026-10-27', title: 'Fresh Start' }],
      },
      sureness: 8.0,
      surprise: 6.5,
      score: 7.5,
      status: 'active',
      createdAt: 9000,
      updatedAt: 9000,
    })
    await db.baselines.put({
      id: 'base_1',
      metricKey: 'p_mood_scale',
      asOfChapterId: 'ch_closed',
      weekdayMean: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5],
      weekdaySd: [1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2],
      n: 10,
      createdAt: 2000,
      updatedAt: 2000,
    })
    await db.stickers.put({
      id: 'st_custom_png',
      name: 'Spark',
      mime: 'image/png',
      blob: new Blob(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])],
        { type: 'image/png' }
      ),
      builtin: false,
      createdAt: 3000,
      updatedAt: 3000,
    })
    await db.settings.bulkPut([
      { key: 'user_name', value: 'Naves' },
      { key: 'push_manage_token_secret', value: 'must-not-export' },
    ])
  })
}

describe('Backup, Recovery Snapshots & Data Health Check (B1-B7)', () => {
  let db: TrinqleDB
  let snapDb: SnapshotsDB

  beforeEach(async () => {
    db = new TrinqleDB(`test_backup_${Date.now()}_${Math.random()}`)
    snapDb = new SnapshotsDB(`test_snaps_${Date.now()}_${Math.random()}`)
    await db.open()
    await snapDb.open()
  })

  it('performs verified full-database backup, delete-all recovery, and lossless restore including photos (B2, B4)', async () => {
    await seedRichDatabase(db)

    const { filename, zipBytes, preview } = await exportFullBackupZip(db)
    expect(filename).toMatch(/^trinqle_full_backup_\d{4}-\d{2}-\d{2}\.zip$/)
    expect(preview.manifest.kind).toBe('full_backup')
    expect(preview.manifest.counts.chapters).toBe(2)
    expect(preview.photosCount).toBe(1)

    // Wipe database completely
    await deleteAllData('DELETE', db)
    expect(await db.chapters.count()).toBe(0)
    expect(await db.days.count()).toBe(0)

    // Restore into fresh DB using full backup
    await importFullBackupZip(zipBytes, db, { mode: 'replace' })

    expect(await db.chapters.count()).toBe(2)
    expect(await db.days.count()).toBe(2)
    expect(await db.answers.count()).toBe(1)
    expect(await db.cycles.count()).toBe(1)
    expect(await db.insights.count()).toBe(1)
    expect(await db.baselines.count()).toBe(1)
    expect(await db.stickers.count()).toBe(1)

    const restoredClosed = await db.chapters.get('ch_closed')
    expect(restoredClosed?.frozen?.dashboard?.[0]?.rendererVersion).toBe(1)
    expect(restoredClosed?.photos).toHaveLength(1)
    expect(restoredClosed?.photos?.[0]).toBeInstanceOf(Blob)
    expect(restoredClosed?.photos?.[0].size).toBe(14)

    // Non-sensitive setting preserved, sensitive push/token setting excluded
    expect((await db.settings.get('user_name'))?.value).toBe('Naves')
    expect(await db.settings.get('push_manage_token_secret')).toBeUndefined()
  })

  it('tracks honest backup status, respects share AbortError cancellation, and nudges properly (B3)', async () => {
    await seedRichDatabase(db)

    const initial = await getBackupStatus(db, 20000)
    expect(initial.lastBackupAt).toBeNull()
    expect(initial.totalActiveDays).toBe(2)
    expect(initial.shouldNudge).toBe(true)

    await db.settings.put({ key: 'last_backup_timestamp', value: 10000 })
    const afterBackup = await getBackupStatus(db, 10000 + 2 * 86400000)
    expect(afterBackup.nightsSinceBackup).toBe(0)
    expect(afterBackup.shouldNudge).toBe(false)

    // Exceed 7 days -> shouldNudge = true
    const after8Days = await getBackupStatus(db, 10000 + 8 * 86400000)
    expect(after8Days.shouldNudge).toBe(true)

    // Cancelled native share sheet must return 'cancelled'
    const origNav = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        canShare: () => true,
        share: async () => {
          const err = new Error('User cancelled')
          err.name = 'AbortError'
          throw err
        },
      },
      configurable: true,
    })
    try {
      const outcome = await downloadOrShareFile('test.zip', new Blob(['abc']))
      expect(outcome).toBe('cancelled')
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: origNav, configurable: true })
    }
  })

  it('retains last 5 safety snapshots in separate DB and restores full state after wipe (B5)', async () => {
    await seedRichDatabase(db)

    for (let i = 1; i <= MAX_SAFETY_SNAPSHOTS + 2; i++) {
      await createSafetySnapshot('manual', `Snap ${i}`, db, snapDb)
    }

    const list = await listSafetySnapshots(snapDb)
    expect(list).toHaveLength(MAX_SAFETY_SNAPSHOTS)
    expect(list[0].label).toBe('Snap 7')

    await db.deleteAllData()
    expect(await db.days.count()).toBe(0)

    await restoreSafetySnapshot(list[0].id, db, snapDb)
    expect(await db.days.count()).toBe(2)
    expect(await db.chapters.count()).toBe(2)
  })

  it('detects orphans, missing photo blobs, invalid values, duplicates, and missing days read-only, and snapshots before fix (B7)', async () => {
    await seedRichDatabase(db)

    // Inject deliberate corruption
    await db.runBypassingClosedGuard(async () => {
      // Orphaned answer
      await db.answers.put({
        id: 'ans_orphan',
        date: '2026-10-27',
        questionId: 'q_mood',
        partId: 'part_does_not_exist',
        instance: 0,
        value: 5,
        createdAt: 9000,
        updatedAt: 9000,
      })
      // Duplicate answer for same (date, questionId, partId, instance)
      await db.answers.put({
        id: 'ans_1_dup',
        date: '2026-10-27',
        questionId: 'q_mood',
        partId: 'p_mood_scale',
        instance: 0,
        value: 7,
        createdAt: 7000,
        updatedAt: 7000,
      })
      // Out-of-range rating & scale answer
      await db.days.put({
        date: '2026-10-28',
        chapterId: 'ch_open',
        overallRating: 99,
        memorability: 1,
        mode: 'full',
        expandedMore: false,
        backfilled: false,
        filledAt: 9000,
        tz: 'UTC',
      })
      // Empty 0-byte photo blob
      await db.chapters.update('ch_open', {
        photos: [new Blob([], { type: 'image/jpeg' })],
      })
    })

    const report = await runDataHealthCheck(db, '2026-10-29')
    expect(report.orphanedAnswers.some((o) => o.answerId === 'ans_orphan')).toBe(true)
    expect(report.duplicateRecords.length).toBe(1)
    expect(report.invalidValues.some((v) => v.date === '2026-10-28')).toBe(true)
    expect(report.missingPhotoBlobs.some((m) => m.chapterId === 'ch_open')).toBe(true)
    // Open chapter started 2026-10-26, missing 2026-10-26 and 2026-10-29 (since 27 and 28 exist)
    expect(report.missingDays).toEqual(['2026-10-29', '2026-10-26'])
    expect(report.totalIssues).toBeGreaterThanOrEqual(4)

    // Read-only guarantee: nothing deleted yet
    expect(await db.answers.get('ans_orphan')).toBeDefined()

    // Explicit fixes must create a safety snapshot first
    const dedupCount = await fixDuplicateRecords(db, snapDb)
    expect(dedupCount).toBe(1)
    const orphanCount = await fixOrphanedAnswers(db, snapDb)
    expect(orphanCount).toBe(1)

    const snaps = await listSafetySnapshots(snapDb)
    expect(snaps.length).toBe(2)
    expect(snaps[0].reason).toBe('before_health_fix')
  })
})
