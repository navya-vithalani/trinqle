import type { TrinqleDB } from '../data/db'
import { db as defaultDb } from '../data/db'
import type {
  Section,
  Question,
  Part,
  Library,
  Item,
  Day,
  Answer,
  AnswerLink,
  Cycle,
  ChapterAnswer,
  Chapter,
  Baseline,
  Run,
  Insight,
  Sticker,
  Setting,
} from '../data/types'
import { createZipArchive, readZipArchiveAsync, type ZipFileInput } from './zip'
import { formatDate } from './logicalDay'
import { sanitizeSvg } from '../characters/sanitizer'
import {
  assertArrayRecords,
  assertObjectRecord,
  extensionForMime,
  mimeForFilename,
  validateImportedImageBinary,
} from './export'

export const FULL_BACKUP_FORMAT_VERSION = 2
const MAX_IMPORT_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_STICKER_BYTES = 2 * 1024 * 1024
const SENSITIVE_SETTING_RE = /(token|vapid|secret|push)/i

function isBlobLike(val: unknown): val is Blob {
  return Boolean(
    val &&
      typeof val === 'object' &&
      typeof (val as Blob).arrayBuffer === 'function' &&
      typeof (val as Blob).size === 'number'
  )
}

export interface FullBackupCounts {
  chapters: number
  days: number
  answers: number
  libraries: number
  items: number
  answerLinks: number
  chapterAnswers: number
  cycles: number
  runs: number
  insights: number
  baselines: number
  stickers: number
  sections: number
  questions: number
  parts: number
  settings: number
}

export interface FullBackupManifest {
  formatVersion: number
  kind: 'full_backup'
  exportedAt: number
  filesCount: number
  counts: FullBackupCounts
  photoMeta: Array<{ chapterId: string; name: string; mime: string }>
}

export interface FullBackupPreview {
  manifest: FullBackupManifest
  chapters: Chapter[]
  photosCount: number
}

interface ParsedFullBackupPayload {
  manifest: FullBackupManifest
  sections: Section[]
  questions: Question[]
  parts: Part[]
  libraries: Library[]
  items: Item[]
  answerLinks: AnswerLink[]
  chapters: Chapter[]
  days: Day[]
  answers: Answer[]
  chapterAnswers: ChapterAnswer[]
  cycles: Cycle[]
  runs: Run[]
  insights: Insight[]
  baselines: Baseline[]
  stickers: Sticker[]
  settings: Setting[]
}

/**
 * Serializes the entire local Trinqle database into a verified Full Backup ZIP byte array.
 * Includes all chapters (with photos & frozen data), days, answers, form schema,
 * libraries, cycles, insights, baselines, stickers, and non-sensitive settings.
 */
export async function buildFullBackupZipBytes(db: TrinqleDB = defaultDb): Promise<{
  filename: string
  zipBytes: Uint8Array
  preview: FullBackupPreview
}> {
  const [
    sections,
    questions,
    parts,
    libraries,
    items,
    answerLinks,
    chapters,
    days,
    answers,
    chapterAnswers,
    cycles,
    runs,
    insights,
    baselines,
    stickers,
    allSettings,
  ] = await Promise.all([
    db.sections.toArray(),
    db.questions.toArray(),
    db.parts.toArray(),
    db.libraries.toArray(),
    db.items.toArray(),
    db.answerLinks.toArray(),
    db.chapters.toArray(),
    db.days.toArray(),
    db.answers.toArray(),
    db.chapterAnswers.toArray(),
    db.cycles.toArray(),
    db.runs.toArray(),
    db.insights.toArray(),
    db.baselines.toArray(),
    db.stickers.toArray(),
    db.settings.toArray(),
  ])

  const settings = allSettings.filter((s) => !SENSITIVE_SETTING_RE.test(s.key))

  const photoMeta: Array<{ chapterId: string; name: string; mime: string }> = []
  const binaryFiles: ZipFileInput[] = []
  const exportedChapters: unknown[] = []

  for (const ch of chapters) {
    const chPhotos = ch.photos || []
    for (let i = 0; i < chPhotos.length; i++) {
      const p = chPhotos[i]
      if (isBlobLike(p) && p.size > 0) {
        const mime = p.type || 'image/jpeg'
        const ext = extensionForMime(mime)
        const name = `images/${ch.id}/photo_${i}.${ext}`
        const bytes = new Uint8Array(await p.arrayBuffer())
        binaryFiles.push({ name, content: bytes })
        photoMeta.push({ chapterId: ch.id, name, mime })
      }
    }
    exportedChapters.push({
      ...ch,
      photos: undefined,
      photosCount: chPhotos.length,
    })
  }

  const stickerPayload: Array<Record<string, unknown>> = []
  for (const st of stickers) {
    if (isBlobLike(st.blob)) {
      const mime = st.mime || st.blob.type || 'image/png'
      const ext = extensionForMime(mime)
      const fileRef = `stickers/${st.id}.${ext}`
      const bytes = new Uint8Array(await st.blob.arrayBuffer())
      binaryFiles.push({ name: fileRef, content: bytes })
      stickerPayload.push({ ...st, blob: undefined, fileRef })
    } else {
      stickerPayload.push({ ...st })
    }
  }

  const dataFiles: ZipFileInput[] = [
    { name: 'form.json', content: JSON.stringify({ sections, questions, parts }, null, 2) },
    { name: 'chapters.json', content: JSON.stringify(exportedChapters, null, 2) },
    { name: 'days.json', content: JSON.stringify(days, null, 2) },
    { name: 'answers.json', content: JSON.stringify(answers, null, 2) },
    {
      name: 'libraries.json',
      content: JSON.stringify({ libraries, items, answerLinks }, null, 2),
    },
    { name: 'chapterAnswers.json', content: JSON.stringify(chapterAnswers, null, 2) },
    { name: 'cycles.json', content: JSON.stringify(cycles, null, 2) },
    { name: 'insights.json', content: JSON.stringify({ runs, insights }, null, 2) },
    { name: 'baselines.json', content: JSON.stringify(baselines, null, 2) },
    { name: 'stickers.json', content: JSON.stringify(stickerPayload, null, 2) },
    { name: 'settings.json', content: JSON.stringify(settings, null, 2) },
  ]

  const exportedAt = Date.now()
  const manifest: FullBackupManifest = {
    formatVersion: FULL_BACKUP_FORMAT_VERSION,
    kind: 'full_backup',
    exportedAt,
    filesCount: 1 + dataFiles.length + binaryFiles.length,
    counts: {
      chapters: chapters.length,
      days: days.length,
      answers: answers.length,
      libraries: libraries.length,
      items: items.length,
      answerLinks: answerLinks.length,
      chapterAnswers: chapterAnswers.length,
      cycles: cycles.length,
      runs: runs.length,
      insights: insights.length,
      baselines: baselines.length,
      stickers: stickers.length,
      sections: sections.length,
      questions: questions.length,
      parts: parts.length,
      settings: settings.length,
    },
    photoMeta,
  }

  const files: ZipFileInput[] = [
    { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
    ...dataFiles,
    ...binaryFiles,
  ]

  const zipBytes = createZipArchive(files)

  // B4: Dry-run re-read and validate generated ZIP before trusting or offering share
  const parsed = await parseAndValidateFullBackup(zipBytes)
  const preview: FullBackupPreview = {
    manifest: parsed.manifest,
    chapters: parsed.chapters,
    photosCount: parsed.manifest.photoMeta.length,
  }

  const today = formatDate(new Date(exportedAt))
  return {
    filename: `trinqle_full_backup_${today}.zip`,
    zipBytes,
    preview,
  }
}

export async function exportFullBackupZip(db: TrinqleDB = defaultDb): Promise<{
  filename: string
  blob: Blob
  zipBytes: Uint8Array
  preview: FullBackupPreview
}> {
  const result = await buildFullBackupZipBytes(db)
  const blob = new Blob([result.zipBytes.buffer as ArrayBuffer], { type: 'application/zip' })
  return { ...result, blob }
}

async function parseAndValidateFullBackup(zipData: Uint8Array): Promise<ParsedFullBackupPayload> {
  const extracted = await readZipArchiveAsync(zipData)
  const textMap = new Map<string, string>()
  const binaryMap = new Map<string, Uint8Array>()

  for (const f of extracted) {
    if (f.name.endsWith('.json')) {
      textMap.set(f.name, f.text())
    } else {
      binaryMap.set(f.name, f.content)
    }
  }

  const manifestStr = textMap.get('manifest.json')
  if (!manifestStr) throw new Error('Invalid full backup: manifest.json missing')

  const manifestRaw = assertObjectRecord(JSON.parse(manifestStr), 'manifest.json')
  if (
    manifestRaw.kind !== 'full_backup' ||
    manifestRaw.formatVersion !== FULL_BACKUP_FORMAT_VERSION
  ) {
    throw new Error(`Unsupported full backup formatVersion: ${manifestRaw.formatVersion}`)
  }
  const manifest = manifestRaw as unknown as FullBackupManifest

  const formStr = textMap.get('form.json')
  const chaptersStr = textMap.get('chapters.json')
  const daysStr = textMap.get('days.json')
  const answersStr = textMap.get('answers.json')
  const librariesStr = textMap.get('libraries.json')
  if (!formStr || !chaptersStr || !daysStr || !answersStr || !librariesStr) {
    throw new Error('Corrupted full backup: essential data files missing')
  }

  const formObj = assertObjectRecord(JSON.parse(formStr), 'form.json')
  const sections = assertArrayRecords(formObj.sections, 'form.sections') as Section[]
  const questions = assertArrayRecords(formObj.questions, 'form.questions') as Question[]
  const parts = assertArrayRecords(formObj.parts, 'form.parts') as Part[]

  const libObj = assertObjectRecord(JSON.parse(librariesStr), 'libraries.json')
  const libraries = assertArrayRecords(libObj.libraries, 'libraries') as Library[]
  const items = assertArrayRecords(libObj.items, 'items') as Item[]
  const answerLinks = assertArrayRecords(libObj.answerLinks, 'answerLinks') as AnswerLink[]

  const rawChapters = assertArrayRecords(JSON.parse(chaptersStr), 'chapters.json') as Array<
    Record<string, unknown>
  >
  const days = assertArrayRecords(JSON.parse(daysStr), 'days.json') as Day[]
  const answers = assertArrayRecords(JSON.parse(answersStr), 'answers.json') as Answer[]

  const chapterAnswers = textMap.get('chapterAnswers.json')
    ? (assertArrayRecords(
        JSON.parse(textMap.get('chapterAnswers.json')!),
        'chapterAnswers.json'
      ) as ChapterAnswer[])
    : []
  const cycles = textMap.get('cycles.json')
    ? (assertArrayRecords(JSON.parse(textMap.get('cycles.json')!), 'cycles.json') as Cycle[])
    : []

  let runs: Run[] = []
  let insights: Insight[] = []
  if (textMap.get('insights.json')) {
    const insObj = assertObjectRecord(JSON.parse(textMap.get('insights.json')!), 'insights.json')
    runs = assertArrayRecords(insObj.runs ?? [], 'insights.runs') as Run[]
    insights = assertArrayRecords(insObj.insights ?? [], 'insights.insights') as Insight[]
  }

  const baselines = textMap.get('baselines.json')
    ? (assertArrayRecords(JSON.parse(textMap.get('baselines.json')!), 'baselines.json') as Baseline[])
    : []
  const settingsRaw = textMap.get('settings.json')
    ? (assertArrayRecords(JSON.parse(textMap.get('settings.json')!), 'settings.json') as Setting[])
    : []
  const settings = settingsRaw.filter(
    (s) => s && typeof s.key === 'string' && !SENSITIVE_SETTING_RE.test(s.key)
  )

  // Rehydrate & validate chapter photos strictly before writing
  const photoMapByChapter = new Map<string, Blob[]>()
  for (const pm of manifest.photoMeta || []) {
    const bytes = binaryMap.get(pm.name)
    if (!bytes) continue
    validateImportedImageBinary(bytes, pm.mime, pm.name, MAX_IMPORT_IMAGE_BYTES)
    const blob = new Blob(
      [bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer],
      { type: pm.mime }
    )
    const list = photoMapByChapter.get(pm.chapterId) || []
    list.push(blob)
    photoMapByChapter.set(pm.chapterId, list)
  }

  const chapters: Chapter[] = rawChapters.map((rc) => {
    if (typeof rc.id !== 'string' || typeof rc.startDate !== 'string') {
      throw new Error('Invalid chapter record in full backup')
    }
    const { photosCount: _ignored, ...rest } = rc
    return {
      ...(rest as unknown as Chapter),
      photos: photoMapByChapter.get(rc.id) || [],
    }
  })

  // Validate & re-sanitize stickers strictly before writing
  const stickers: Sticker[] = []
  if (textMap.get('stickers.json')) {
    const rawStickers = assertArrayRecords(
      JSON.parse(textMap.get('stickers.json')!),
      'stickers.json'
    ) as Array<Omit<Sticker, 'blob'> & { blob?: string; fileRef?: string }>

    for (const st of rawStickers) {
      let resolvedBlob: Blob | string | undefined = st.blob
      const isSvgSticker =
        st.mime?.toLowerCase().includes('svg') ||
        (typeof st.blob === 'string' && st.blob.trim().startsWith('<svg'))

      if (st.fileRef && binaryMap.has(st.fileRef)) {
        const b = binaryMap.get(st.fileRef)!
        const targetMime = (st.mime || mimeForFilename(st.fileRef)).toLowerCase()
        if (targetMime.includes('svg')) {
          const san = sanitizeSvg(new TextDecoder().decode(b))
          if (!san.valid) throw new Error(`Invalid SVG sticker (${st.name}): ${san.error}`)
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
        if (!san.valid) throw new Error(`Unsafe SVG sticker rejected (${st.name}): ${san.error}`)
        resolvedBlob = san.cleanSvg
      }
      const { fileRef: _ignored, ...clean } = st
      stickers.push({ ...clean, blob: resolvedBlob })
    }
  }

  return {
    manifest,
    sections,
    questions,
    parts,
    libraries,
    items,
    answerLinks,
    chapters,
    days,
    answers,
    chapterAnswers,
    cycles,
    runs,
    insights,
    baselines,
    stickers,
    settings,
  }
}

/**
 * Inspects a Full Backup ZIP without mutating IndexedDB.
 */
export async function inspectFullBackupZip(zipData: Uint8Array): Promise<FullBackupPreview> {
  const parsed = await parseAndValidateFullBackup(zipData)
  return {
    manifest: parsed.manifest,
    chapters: parsed.chapters,
    photosCount: parsed.manifest.photoMeta.length,
  }
}

/**
 * Restores a validated Full Backup ZIP into IndexedDB inside a single atomic transaction.
 */
export async function importFullBackupZip(
  zipData: Uint8Array,
  db: TrinqleDB = defaultDb,
  options: { mode?: 'replace' | 'merge' } = {}
): Promise<FullBackupCounts> {
  const mode = options.mode ?? 'replace'
  const data = await parseAndValidateFullBackup(zipData)

  await db.runBypassingClosedGuard(() =>
    db.transaction(
      'rw',
      [
        db.sections,
        db.questions,
        db.parts,
        db.libraries,
        db.items,
        db.answerLinks,
        db.chapters,
        db.days,
        db.answers,
        db.chapterAnswers,
        db.cycles,
        db.runs,
        db.insights,
        db.baselines,
        db.stickers,
        db.settings,
      ],
      async () => {
        if (mode === 'replace') {
          await Promise.all([
            db.sections.clear(),
            db.questions.clear(),
            db.parts.clear(),
            db.libraries.clear(),
            db.items.clear(),
            db.answerLinks.clear(),
            db.chapters.clear(),
            db.days.clear(),
            db.answers.clear(),
            db.chapterAnswers.clear(),
            db.cycles.clear(),
            db.runs.clear(),
            db.insights.clear(),
            db.baselines.clear(),
            db.stickers.clear(),
            db.settings.clear(),
          ])
        }

        if (data.sections.length) await db.sections.bulkPut(data.sections)
        if (data.questions.length) await db.questions.bulkPut(data.questions)
        if (data.parts.length) await db.parts.bulkPut(data.parts)
        if (data.libraries.length) await db.libraries.bulkPut(data.libraries)

        if (mode === 'merge') {
          const currentItems = await db.items.toArray()
          const remap = new Map<string, string>()
          for (const it of data.items) {
            if (currentItems.some((c) => c.id === it.id)) {
              await db.items.put(it)
              continue
            }
            const byName = currentItems.find(
              (c) =>
                c.libraryId === it.libraryId &&
                c.name.trim().toLowerCase() === it.name.trim().toLowerCase()
            )
            if (byName) remap.set(it.id, byName.id)
            else await db.items.put(it)
          }
          if (data.answerLinks.length) {
            await db.answerLinks.bulkPut(
              data.answerLinks.map((lnk) => ({
                ...lnk,
                itemId: remap.get(lnk.itemId) || lnk.itemId,
              }))
            )
          }
        } else {
          if (data.items.length) await db.items.bulkPut(data.items)
          if (data.answerLinks.length) await db.answerLinks.bulkPut(data.answerLinks)
        }

        if (data.chapters.length) await db.chapters.bulkPut(data.chapters)
        if (data.days.length) await db.days.bulkPut(data.days)
        if (data.answers.length) await db.answers.bulkPut(data.answers)
        if (data.chapterAnswers.length) await db.chapterAnswers.bulkPut(data.chapterAnswers)
        if (data.cycles.length) await db.cycles.bulkPut(data.cycles)
        if (data.runs.length) await db.runs.bulkPut(data.runs)
        if (data.insights.length) await db.insights.bulkPut(data.insights)
        if (data.baselines.length) await db.baselines.bulkPut(data.baselines)
        if (data.stickers.length) await db.stickers.bulkPut(data.stickers)
        if (data.settings.length) await db.settings.bulkPut(data.settings)
      }
    )
  )

  return data.manifest.counts
}

export interface BackupStatusInfo {
  lastBackupAt: number | null
  lastBackupDate: string | null
  daysSinceBackup: number | null
  nightsSinceBackup: number
  totalActiveDays: number
  shouldNudge: boolean
}

/**
 * Computes honest backup status and weekly/nights-since nudge state (B3).
 */
export async function getBackupStatus(
  db: TrinqleDB = defaultDb,
  nowMs: number = Date.now()
): Promise<BackupStatusInfo> {
  const [lastBackupSetting, activeDays] = await Promise.all([
    db.settings.get('last_backup_timestamp'),
    db.days.filter((d) => !d.deletedAt).toArray(),
  ])

  const lastBackupAt =
    typeof lastBackupSetting?.value === 'number' && lastBackupSetting.value > 0
      ? lastBackupSetting.value
      : null

  const totalActiveDays = activeDays.length
  const lastBackupDate = lastBackupAt ? formatDate(new Date(lastBackupAt)) : null
  const daysSinceBackup = lastBackupAt
    ? Math.max(0, Math.floor((nowMs - lastBackupAt) / (1000 * 60 * 60 * 24)))
    : null

  const nightsSinceBackup = lastBackupAt
    ? activeDays.filter((d) => (d.editedAt ?? d.filledAt) > lastBackupAt).length
    : totalActiveDays

  const shouldNudge =
    (lastBackupAt === null && totalActiveDays >= 1) ||
    (daysSinceBackup !== null && daysSinceBackup >= 7) ||
    nightsSinceBackup >= 7

  return {
    lastBackupAt,
    lastBackupDate,
    daysSinceBackup,
    nightsSinceBackup,
    totalActiveDays,
    shouldNudge,
  }
}
