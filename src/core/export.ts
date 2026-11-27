import type { TrinqleDB } from '../data/db'
import { db as defaultDb } from '../data/db'
import type {
  Chapter,
  Day,
  Answer,
  ChapterAnswer,
  Cycle,
  Run,
  Insight,
  Sticker,
} from '../data/types'
import { createZipArchive, readZipArchiveAsync, type ZipFileInput } from './zip'
import { buildDailyMetricsTable } from './metrics'
import { sanitizeSvg } from '../characters/sanitizer'

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMPORT_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_STICKER_BYTES = 2 * 1024 * 1024

function hasValidRasterSignature(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 12) return false
  const m = mime.toLowerCase()
  if (m === 'image/png') {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  }
  if (m === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (m === 'image/gif') {
    return (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    )
  }
  if (m === 'image/webp') {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    )
  }
  return false
}

function validateImportedImageBinary(bytes: Uint8Array, mime: string, label: string, maxBytes: number): void {
  const normalized = mime.toLowerCase()
  if (!ALLOWED_IMAGE_MIMES.has(normalized)) {
    throw new Error(`Unsupported image MIME type (${mime}) for ${label}`)
  }
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
    throw new Error(`Image ${label} size is invalid or exceeds limit`)
  }
  if (!hasValidRasterSignature(bytes, normalized)) {
    throw new Error(`Image ${label} file signature does not match ${normalized}`)
  }
}

function assertObjectRecord(val: unknown, label: string): Record<string, unknown> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) {
    throw new Error(`Invalid ${label} structure in archive`)
  }
  return val as Record<string, unknown>
}

function assertArrayRecords(val: unknown, label: string): unknown[] {
  if (!Array.isArray(val)) {
    throw new Error(`Invalid ${label} list in archive`)
  }
  return val
}

export interface ChapterManifest {
  formatVersion: number
  kind: 'chapter' | 'backup'
  chapterId: string
  exportedAt: number
  filesCount: number
  photoMeta?: { name: string; mime: string }[]
}

function extensionForMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('png')) return 'png'
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  if (m.includes('gif')) return 'gif'
  return 'webp'
}

function mimeForFilename(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/webp'
}

/**
 * Exports a Chapter (or Open Chapter Backup) as a standard .zip archive.
 * Lossless export including manifest.json, chapter.json, days.json, answers.json,
 * libraries.json, chapterAnswers.json, cycles.json, insights.json, stickers.json, and photos.
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
  const chapterAnswers = (await db.chapterAnswers.where('chapterId').equals(chapterId).toArray()).filter(
    (ca) => !ca.deletedAt
  )

  const chapterEnd = chapter.endDate || chapter.plannedEndDate
  const cycles = (await db.cycles.toArray()).filter(
    (c) =>
      !c.deletedAt &&
      c.startDate <= chapterEnd &&
      (!c.endDate || c.endDate >= chapter.startDate)
  )

  const allRuns = (await db.runs.toArray()).filter((r) => !r.deletedAt)
  const relevantRuns = allRuns.filter(
    (r) => r.windowEnd >= chapter.startDate && r.windowStart <= chapterEnd
  )
  const relevantRunIds = new Set(relevantRuns.map((r) => r.id))
  const insights = (await db.insights.toArray()).filter(
    (ins) => !ins.deletedAt && relevantRunIds.has(ins.runId)
  )

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

  // Fetch referenced custom stickers
  const usedStickerIds = new Set(days.map((d) => d.stickerId).filter((s): s is string => Boolean(s)))
  const customStickers = (await db.stickers.toArray()).filter(
    (s) => !s.deletedAt && !s.builtin && usedStickerIds.has(s.id)
  )

  const serializedChapter: Omit<Chapter, 'photos'> & { photosCount?: number } = {
    ...chapter,
    photosCount: chapter.photos?.length || 0,
  }
  delete (serializedChapter as Partial<Chapter>).photos

  const photoMeta: { name: string; mime: string }[] = []
  const extraFiles: ZipFileInput[] = []

  if (chapter.photos && chapter.photos.length > 0) {
    for (let i = 0; i < chapter.photos.length; i++) {
      const p = chapter.photos[i]
      if (!(p instanceof Blob)) continue
      const mime = p.type || 'image/jpeg'
      const ext = extensionForMime(mime)
      const name = `images/photo_${i + 1}.${ext}`
      const arrayBuffer = await p.arrayBuffer()
      photoMeta.push({ name, mime })
      extraFiles.push({
        name,
        content: new Uint8Array(arrayBuffer),
      })
    }
  }

  // Export custom stickers safely (string payloads stay in stickers.json; Blob payloads written as files)
  const stickerPayload: Array<Omit<Sticker, 'blob'> & { blob?: string; fileRef?: string }> = []
  for (const st of customStickers) {
    if (st.blob instanceof Blob) {
      const ext = st.mime.includes('svg') ? 'svg' : extensionForMime(st.mime || 'image/png')
      const fileRef = `stickers/${st.id}.${ext}`
      const ab = await st.blob.arrayBuffer()
      extraFiles.push({ name: fileRef, content: new Uint8Array(ab) })
      stickerPayload.push({ ...st, blob: undefined, fileRef })
    } else {
      stickerPayload.push({ ...st, blob: typeof st.blob === 'string' ? st.blob : undefined })
    }
  }

  const baseFiles: ZipFileInput[] = [
    {
      name: 'chapter.json',
      content: JSON.stringify(serializedChapter, null, 2),
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
    {
      name: 'chapterAnswers.json',
      content: JSON.stringify(chapterAnswers, null, 2),
    },
    {
      name: 'cycles.json',
      content: JSON.stringify(cycles, null, 2),
    },
    {
      name: 'insights.json',
      content: JSON.stringify({ runs: relevantRuns, insights }, null, 2),
    },
    {
      name: 'stickers.json',
      content: JSON.stringify(stickerPayload, null, 2),
    },
  ]

  const now = Date.now()
  const manifest: ChapterManifest = {
    formatVersion: 1,
    kind: isBackup ? 'backup' : 'chapter',
    chapterId,
    exportedAt: now,
    filesCount: 1 + baseFiles.length + extraFiles.length,
    photoMeta,
  }

  const files: ZipFileInput[] = [
    {
      name: 'manifest.json',
      content: JSON.stringify(manifest, null, 2),
    },
    ...baseFiles,
    ...extraFiles,
  ]

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

export interface ChapterZipPreview {
  manifest: ChapterManifest
  chapter: Chapter
  daysCount: number
  answersCount: number
  photosCount: number
  chapterAnswersCount: number
  cyclesCount: number
}

/**
 * Inspects a Chapter ZIP archive without mutating IndexedDB.
 */
export async function inspectChapterZip(zipData: Uint8Array): Promise<ChapterZipPreview> {
  const extractedFiles = await readZipArchiveAsync(zipData)
  const textMap = new Map<string, string>()

  for (const f of extractedFiles) {
    if (f.name.endsWith('.json')) {
      textMap.set(f.name, f.text())
    }
  }

  const manifestStr = textMap.get('manifest.json')
  if (!manifestStr) throw new Error('Invalid archive: manifest.json missing')
  const manifest = JSON.parse(manifestStr) as ChapterManifest
  if (manifest.formatVersion !== 1 || (manifest.kind !== 'chapter' && manifest.kind !== 'backup')) {
    throw new Error(`Unsupported or invalid manifest formatVersion: ${manifest.formatVersion}`)
  }

  const chapterStr = textMap.get('chapter.json')
  const daysStr = textMap.get('days.json')
  const answersStr = textMap.get('answers.json')
  if (!chapterStr || !daysStr || !answersStr) {
    throw new Error('Corrupted archive: missing essential JSON data files')
  }

  const chapterObj = assertObjectRecord(JSON.parse(chapterStr), 'chapter.json')
  if (typeof chapterObj.id !== 'string' || typeof chapterObj.startDate !== 'string') {
    throw new Error('Invalid chapter metadata in chapter.json')
  }
  const chapter = chapterObj as unknown as Chapter
  const days = assertArrayRecords(JSON.parse(daysStr), 'days.json') as Day[]
  const answers = assertArrayRecords(JSON.parse(answersStr), 'answers.json') as Answer[]
  const chapterAnswersStr = textMap.get('chapterAnswers.json')
  const cyclesStr = textMap.get('cycles.json')
  const photoFiles = extractedFiles.filter((f) => f.name.startsWith('images/'))

  return {
    manifest,
    chapter,
    daysCount: days.length,
    answersCount: answers.length,
    photosCount: photoFiles.length,
    chapterAnswersCount: chapterAnswersStr
      ? (assertArrayRecords(JSON.parse(chapterAnswersStr), 'chapterAnswers.json') as ChapterAnswer[]).length
      : 0,
    cyclesCount: cyclesStr
      ? (assertArrayRecords(JSON.parse(cyclesStr), 'cycles.json') as Cycle[]).length
      : 0,
  }
}

/**
 * Imports a Chapter ZIP archive into the database with schema/version validation.
 */
export async function importChapterZip(
  zipData: Uint8Array,
  db: TrinqleDB = defaultDb,
  options?: { conflictMode?: 'replace' | 'skip' }
): Promise<{ chapter: Chapter; daysCount: number; answersCount: number; skipped?: boolean }> {
  const extractedFiles = await readZipArchiveAsync(zipData)
  const fileMap = new Map<string, string>()
  const binaryMap = new Map<string, Uint8Array>()

  for (const f of extractedFiles) {
    if (f.name.endsWith('.json')) {
      fileMap.set(f.name, f.text())
    } else {
      binaryMap.set(f.name, f.content)
    }
  }

  const manifestStr = fileMap.get('manifest.json')
  if (!manifestStr) {
    throw new Error('Invalid archive: manifest.json missing')
  }

  const manifest = JSON.parse(manifestStr) as ChapterManifest
  if (manifest.formatVersion !== 1 || (manifest.kind !== 'chapter' && manifest.kind !== 'backup')) {
    throw new Error(`Unsupported formatVersion: ${manifest.formatVersion}`)
  }

  const chapterStr = fileMap.get('chapter.json')
  const daysStr = fileMap.get('days.json')
  const answersStr = fileMap.get('answers.json')
  const librariesStr = fileMap.get('libraries.json')
  const chapterAnswersStr = fileMap.get('chapterAnswers.json')
  const cyclesStr = fileMap.get('cycles.json')
  const insightsStr = fileMap.get('insights.json')
  const stickersStr = fileMap.get('stickers.json')

  if (!chapterStr || !daysStr || !answersStr) {
    throw new Error('Corrupted archive: missing essential JSON data files')
  }

  const chapterRaw = assertObjectRecord(JSON.parse(chapterStr), 'chapter.json')
  if (typeof chapterRaw.id !== 'string' || typeof chapterRaw.startDate !== 'string') {
    throw new Error('Invalid chapter record in archive')
  }
  const chapter = chapterRaw as unknown as Chapter & { photosCount?: number }
  delete chapter.photosCount
  const days = assertArrayRecords(JSON.parse(daysStr), 'days.json') as Day[]
  const answers = assertArrayRecords(JSON.parse(answersStr), 'answers.json') as Answer[]

  const existingChapter = await db.chapters.get(chapter.id)
  if (options?.conflictMode === 'skip' && existingChapter && !existingChapter.deletedAt) {
    return {
      chapter: existingChapter,
      daysCount: 0,
      answersCount: 0,
      skipped: true,
    }
  }

  // Validate and rehydrate photos before touching DB
  const photoBlobs: Blob[] = []
  if (manifest.photoMeta && manifest.photoMeta.length > 0) {
    for (const pm of manifest.photoMeta) {
      const bytes = binaryMap.get(pm.name)
      if (bytes) {
        validateImportedImageBinary(bytes, pm.mime, pm.name, MAX_IMPORT_IMAGE_BYTES)
        photoBlobs.push(new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: pm.mime }))
      }
    }
  } else {
    const imgEntries = extractedFiles
      .filter((f) => f.name.startsWith('images/'))
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const f of imgEntries) {
      const mime = mimeForFilename(f.name)
      validateImportedImageBinary(f.content, mime, f.name, MAX_IMPORT_IMAGE_BYTES)
      photoBlobs.push(new Blob([f.content.buffer.slice(f.content.byteOffset, f.content.byteOffset + f.content.byteLength) as ArrayBuffer], { type: mime }))
    }
  }
  chapter.photos = photoBlobs

  // Validate & re-sanitize optional tables BEFORE opening write transaction
  const parsedLibraries = librariesStr
    ? assertObjectRecord(JSON.parse(librariesStr), 'libraries.json')
    : null
  const parsedChapterAnswers = chapterAnswersStr
    ? (assertArrayRecords(JSON.parse(chapterAnswersStr), 'chapterAnswers.json') as ChapterAnswer[])
    : null
  const parsedCycles = cyclesStr
    ? (assertArrayRecords(JSON.parse(cyclesStr), 'cycles.json') as Cycle[])
    : null
  const parsedInsightsBundle = insightsStr
    ? (assertObjectRecord(JSON.parse(insightsStr), 'insights.json') as { runs?: Run[]; insights?: Insight[] })
    : null

  const validatedStickers: Sticker[] = []
  if (stickersStr) {
    const importedStickers = assertArrayRecords(JSON.parse(stickersStr), 'stickers.json') as Array<
      Omit<Sticker, 'blob'> & { blob?: string; fileRef?: string }
    >
    for (const st of importedStickers) {
      let resolvedBlob: Blob | string | undefined = st.blob
      const isSvgSticker =
        st.mime?.toLowerCase().includes('svg') ||
        (typeof st.blob === 'string' && st.blob.trim().startsWith('<svg'))

      if (st.fileRef && binaryMap.has(st.fileRef)) {
        const b = binaryMap.get(st.fileRef)!
        const targetMime = (st.mime || mimeForFilename(st.fileRef)).toLowerCase()
        if (targetMime.includes('svg')) {
          const decoded = new TextDecoder().decode(b)
          const san = sanitizeSvg(decoded)
          if (!san.valid) {
            throw new Error(`Invalid SVG sticker in archive (${st.name}): ${san.error}`)
          }
          resolvedBlob = san.cleanSvg
        } else {
          validateImportedImageBinary(b, targetMime, st.fileRef, MAX_IMPORT_STICKER_BYTES)
          resolvedBlob = new Blob(
            [b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer],
            { type: targetMime }
          )
        }
      } else if (isSvgSticker && typeof st.blob === 'string') {
        const rawSvg = st.blob.startsWith('data:image/svg+xml')
          ? decodeURIComponent(st.blob.replace(/^data:image\/svg\+xml(?:;utf8|,|;base64,)?/i, ''))
          : st.blob
        const san = sanitizeSvg(rawSvg)
        if (!san.valid) {
          throw new Error(`Unsafe SVG sticker rejected on import (${st.name}): ${san.error}`)
        }
        resolvedBlob = san.cleanSvg
      }
      const { fileRef: _ignored, ...clean } = st
      validatedStickers.push({ ...clean, blob: resolvedBlob })
    }
  }

  await db.runBypassingClosedGuard(() =>
    db.transaction(
      'rw',
      [
        db.chapters,
        db.days,
        db.answers,
        db.libraries,
        db.items,
        db.answerLinks,
        db.chapterAnswers,
        db.cycles,
        db.runs,
        db.insights,
        db.stickers,
      ],
      async () => {
      // 1. Put Chapter
      await db.chapters.put(chapter)

      // 2. Put Days & Answers
      if (days.length > 0) {
        await db.days.bulkPut(days)
      }
      if (answers.length > 0) {
        await db.answers.bulkPut(answers)
      }

      // 3. Merge Libraries, Items (by id then normalized name), and AnswerLinks
      if (parsedLibraries) {
        const libData = parsedLibraries as {
          libraries?: any[]
          items?: any[]
          answerLinks?: any[]
        }
        if (libData.libraries) {
          for (const l of libData.libraries) {
            const existing = await db.libraries.get(l.id)
            if (!existing) await db.libraries.put(l)
          }
        }
        const itemIdRemap = new Map<string, string>()
        if (libData.items) {
          const currentItems = await db.items.toArray()
          for (const it of libData.items) {
            const existingById = currentItems.find((c) => c.id === it.id)
            if (existingById) continue
            const existingByName = currentItems.find(
              (c) =>
                c.libraryId === it.libraryId &&
                c.name.trim().toLowerCase() === String(it.name).trim().toLowerCase()
            )
            if (existingByName) {
              itemIdRemap.set(it.id, existingByName.id)
            } else {
              await db.items.put(it)
            }
          }
        }
        if (libData.answerLinks) {
          const links = libData.answerLinks.map((lnk: any) => ({
            ...lnk,
            itemId: itemIdRemap.get(lnk.itemId) || lnk.itemId,
          }))
          await db.answerLinks.bulkPut(links)
        }
      }

      // 4. Put ChapterAnswers, Cycles, Insights/Runs, and Re-Sanitized Stickers
      if (parsedChapterAnswers && parsedChapterAnswers.length > 0) {
        await db.chapterAnswers.bulkPut(parsedChapterAnswers)
      }
      if (parsedCycles && parsedCycles.length > 0) {
        await db.cycles.bulkPut(parsedCycles)
      }
      if (parsedInsightsBundle) {
        if (parsedInsightsBundle.runs && parsedInsightsBundle.runs.length > 0) {
          await db.runs.bulkPut(parsedInsightsBundle.runs)
        }
        if (parsedInsightsBundle.insights && parsedInsightsBundle.insights.length > 0) {
          await db.insights.bulkPut(parsedInsightsBundle.insights)
        }
      }
      if (validatedStickers.length > 0) {
        await db.stickers.bulkPut(validatedStickers)
      }
      }
    )
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
