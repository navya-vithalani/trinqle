import type { TrinqleDB } from '../data/db'
import { db as defaultDb } from '../data/db'
import type { Chapter, Day, Answer } from '../data/types'
import { createZipArchive, readZipArchive, type ZipFileInput } from './zip'
import { buildDailyMetricsTable } from './metrics'

export interface ChapterManifest {
  formatVersion: number
  kind: 'chapter' | 'backup'
  chapterId: string
  exportedAt: number
  filesCount: number
}

/**
 * Exports a Chapter (or Open Chapter Backup) as a standard .zip archive.
 * Includes manifest.json, chapter.json, days.json, answers.json, libraries.json.
 */
export async function exportChapterZip(
  chapterId: string,
  db: TrinqleDB = defaultDb
): Promise<{ filename: string; blob: Blob }> {
  const chapter = await db.chapters.get(chapterId)
  if (!chapter) throw new Error(`Chapter ${chapterId} not found`)

  const isBackup = chapter.status === 'open'

  // Fetch days and answers for this chapter
  const days = await db.days
    .where('chapterId')
    .equals(chapterId)
    .filter((d) => !d.deletedAt)
    .toArray()

  const allowedDates = new Set(days.map((d) => d.date))
  const answers = (await db.answers.toArray()).filter((a) => !a.deletedAt && allowedDates.has(a.date))
  const answerLinks = (await db.answerLinks.toArray()).filter((l) => !l.deletedAt && allowedDates.has(l.date))

  // Fetch referenced libraries and items
  const referencedItemIds = new Set(answerLinks.map((l) => l.itemId))
  const allItems = await db.items.toArray()
  const referencedItems = allItems.filter((i) => referencedItemIds.has(i.id))

  const referencedLibIds = new Set([
    ...answerLinks.map((l) => l.libraryId),
    ...referencedItems.map((i) => i.libraryId),
  ])
  const allLibraries = await db.libraries.toArray()
  const referencedLibraries = allLibraries.filter((l) => referencedLibIds.has(l.id))

  const now = Date.now()
  const manifest: ChapterManifest = {
    formatVersion: 1,
    kind: isBackup ? 'backup' : 'chapter',
    chapterId,
    exportedAt: now,
    filesCount: 5,
  }

  const files: ZipFileInput[] = [
    {
      name: 'manifest.json',
      content: JSON.stringify(manifest, null, 2),
    },
    {
      name: 'chapter.json',
      content: JSON.stringify(chapter, null, 2),
    },
    {
      name: 'days.json',
      content: JSON.stringify(days, null, 2),
    },
    {
      name: 'answers.json',
      content: JSON.stringify(answers, null, 2),
    },
    {
      name: 'libraries.json',
      content: JSON.stringify(
        {
          libraries: referencedLibraries,
          items: referencedItems,
          answerLinks,
        },
        null,
        2
      ),
    },
  ]

  // Add photos if present
  if (chapter.photos && chapter.photos.length > 0) {
    for (let i = 0; i < chapter.photos.length; i++) {
      const p = chapter.photos[i]
      const arrayBuffer = await p.arrayBuffer()
      files.push({
        name: `images/photo_${i + 1}.webp`,
        content: new Uint8Array(arrayBuffer),
      })
    }
  }

  const zipBytes = createZipArchive(files)
  const zipBlob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' })
  const safeTitle = (chapter.title || `Chapter_${chapter.id.slice(0, 8)}`)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
  const filename = `${safeTitle}_${isBackup ? 'backup' : 'archive'}.zip`

  return { filename, blob: zipBlob }
}

/**
 * Triggers native share sheet or downloads the blob to device.
 */
export async function downloadOrShareFile(filename: string, blob: Blob): Promise<void> {
  const file = new File([blob], filename, { type: blob.type })

  // Check Web Share API with files support
  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: 'Trinqle Chapter Export',
      })
      return
    } catch (err: any) {
      if (err.name === 'AbortError') return
    }
  }

  // Fallback to direct download anchor
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Imports a Chapter ZIP archive into the database with schema/version validation.
 */
export async function importChapterZip(
  zipData: Uint8Array,
  db: TrinqleDB = defaultDb
): Promise<{ chapter: Chapter; daysCount: number; answersCount: number }> {
  const extractedFiles = readZipArchive(zipData)
  const fileMap = new Map<string, string>()

  for (const f of extractedFiles) {
    if (f.name.endsWith('.json')) {
      fileMap.set(f.name, f.text())
    }
  }

  const manifestStr = fileMap.get('manifest.json')
  if (!manifestStr) {
    throw new Error('Invalid archive: manifest.json missing')
  }

  const manifest = JSON.parse(manifestStr) as ChapterManifest
  if (manifest.formatVersion !== 1) {
    throw new Error(`Unsupported formatVersion: ${manifest.formatVersion}`)
  }

  const chapterStr = fileMap.get('chapter.json')
  const daysStr = fileMap.get('days.json')
  const answersStr = fileMap.get('answers.json')
  const librariesStr = fileMap.get('libraries.json')

  if (!chapterStr || !daysStr || !answersStr) {
    throw new Error('Corrupted archive: missing essential JSON data files')
  }

  const chapter = JSON.parse(chapterStr) as Chapter
  const days = JSON.parse(daysStr) as Day[]
  const answers = JSON.parse(answersStr) as Answer[]

  await db.transaction(
    'rw',
    [db.chapters, db.days, db.answers, db.libraries, db.items, db.answerLinks],
    async () => {
      // 1. Put Chapter
      await db.chapters.put(chapter)

      // 2. Put Days
      if (days.length > 0) {
        await db.days.bulkPut(days)
      }

      // 3. Put Answers
      if (answers.length > 0) {
        await db.answers.bulkPut(answers)
      }

      // 4. Merge Libraries and Items if present
      if (librariesStr) {
        const libData = JSON.parse(librariesStr)
        if (libData.libraries) {
          for (const l of libData.libraries) {
            const existing = await db.libraries.get(l.id)
            if (!existing) await db.libraries.put(l)
          }
        }
        if (libData.items) {
          for (const it of libData.items) {
            const existing = await db.items.get(it.id)
            if (!existing) await db.items.put(it)
          }
        }
        if (libData.answerLinks) {
          await db.answerLinks.bulkPut(libData.answerLinks)
        }
      }
    }
  )

  return {
    chapter,
    daysCount: days.length,
    answersCount: answers.length,
  }
}

/**
 * Exports all data as two comprehensive CSV tables per TRD Section 9:
 * 1. Daily wide table: One row per day with all active metrics as columns.
 * 2. Sessions long table: One row per time range / multi-instance session.
 */
export async function exportCSVData(
  db: TrinqleDB = defaultDb
): Promise<{ wideCSV: string; sessionsCSV: string }> {
  const days = await db.days.filter((d) => !d.deletedAt).toArray()
  const answers = await db.answers.filter((a) => !a.deletedAt).toArray()
  const questions = await db.questions.filter((q) => !q.deletedAt).toArray()
  const parts = await db.parts.filter((p) => !p.deletedAt).toArray()

  const dailyTable = buildDailyMetricsTable(days, answers, questions, parts)

  // 1. Build Daily Wide Table CSV
  const metricKeys = dailyTable.metrics.map((m) => m.key)
  const wideHeaders = [
    'Date',
    'ChapterId',
    'DayTitle',
    'Mode',
    'OverallRating',
    'Memorability',
    ...metricKeys,
  ]

  const wideRows: string[] = [wideHeaders.join(',')]

  for (const row of dailyTable.rows) {
    const safeTitle = (row.dayTitle || '').replace(/"/g, '""')
    const cols = [
      row.date,
      row.chapterId || '',
      `"${safeTitle}"`,
      row.mode || '',
      row.overallRating ?? '',
      row.memorability ?? '',
    ]

    for (const k of metricKeys) {
      const val = row.values[k]
      cols.push(val === null || val === undefined ? '' : String(val))
    }

    wideRows.push(cols.join(','))
  }

  // 2. Build Sessions Long Table CSV
  const sessionsHeaders = [
    'Date',
    'QuestionId',
    'PartId',
    'Instance',
    'StartTime',
    'EndTime',
    'CrossesMidnight',
    'DurationMinutes',
    'TextOrValue',
  ]
  const sessionsRows: string[] = [sessionsHeaders.join(',')]

  for (const ans of answers) {
    if (ans.value && typeof ans.value === 'object' && 'start' in ans.value) {
      const tr = ans.value as any
      sessionsRows.push(
        [
          ans.date,
          ans.questionId,
          ans.partId,
          ans.instance,
          tr.start || '',
          tr.end || '',
          tr.crossesMidnight ? 'true' : 'false',
          '',
          '',
        ].join(',')
      )
    }
  }

  return {
    wideCSV: wideRows.join('\n'),
    sessionsCSV: sessionsRows.join('\n'),
  }
}

/**
 * Requests browser persistent storage per TRD Section 9.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist()
  }
  return false
}

/**
 * Checks if browser storage is already persisted.
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    return await navigator.storage.persisted()
  }
  return false
}
