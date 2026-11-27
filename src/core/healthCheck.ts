import type { TrinqleDB } from '../data/db'
import { db as defaultDb } from '../data/db'
import type { Answer, ScaleConfig, TimeRangeValue } from '../data/types'
import { isStoragePersisted } from './export'
import { getBackupStatus, type BackupStatusInfo } from './fullBackup'
import { addDays, logicalDate } from './logicalDay'
import { createSafetySnapshot, defaultSnapshotsDb, type SnapshotsDB } from './snapshots'

export interface OrphanedAnswerIssue {
  answerId: string
  date: string
  questionId: string
  partId: string
  reason: 'missing_part' | 'missing_question' | 'missing_day'
}

export interface MissingPhotoIssue {
  chapterId: string
  chapterTitle: string
  photoIndex: number
  reason: string
}

export interface InvalidValueIssue {
  entity: 'day' | 'answer'
  id: string
  date: string
  detail: string
}

export interface DuplicateRecordIssue {
  table: 'answers' | 'answerLinks'
  key: string
  duplicateIds: string[]
}

export interface DataHealthReport {
  checkedAt: number
  isPersisted: boolean
  backupStatus: BackupStatusInfo
  storageEstimate: {
    usageBytes: number | null
    quotaBytes: number | null
    estimatedRecordBytes: number
    totalRecords: number
  }
  orphanedAnswers: OrphanedAnswerIssue[]
  missingPhotoBlobs: MissingPhotoIssue[]
  invalidValues: InvalidValueIssue[]
  duplicateRecords: DuplicateRecordIssue[]
  missingDays: string[]
  openChapterId: string | null
  totalIssues: number
}

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

function isBlobLike(val: unknown): val is Blob {
  return Boolean(
    val &&
      typeof val === 'object' &&
      typeof (val as Blob).size === 'number' &&
      typeof (val as Blob).arrayBuffer === 'function'
  )
}

/**
 * Read-only database integrity scan reporting orphans, missing photo blobs,
 * invalid/out-of-range values, duplicates, DB footprint, storage/backup status,
 * and missing nights in the active open chapter (B7).
 */
export async function runDataHealthCheck(
  db: TrinqleDB = defaultDb,
  todayDateStr: string = logicalDate(new Date())
): Promise<DataHealthReport> {
  const [
    isPersisted,
    backupStatus,
    questions,
    parts,
    chapters,
    days,
    answers,
    answerLinks,
    cycles,
    chapterAnswers,
    stickers,
  ] = await Promise.all([
    isStoragePersisted().catch(() => false),
    getBackupStatus(db),
    db.questions.filter((q) => !q.deletedAt).toArray(),
    db.parts.filter((p) => !p.deletedAt).toArray(),
    db.chapters.filter((c) => !c.deletedAt).toArray(),
    db.days.filter((d) => !d.deletedAt).toArray(),
    db.answers.filter((a) => !a.deletedAt).toArray(),
    db.answerLinks.filter((l) => !l.deletedAt).toArray(),
    db.cycles.filter((c) => !c.deletedAt).toArray(),
    db.chapterAnswers.filter((ca) => !ca.deletedAt).toArray(),
    db.stickers.filter((s) => !s.deletedAt).toArray(),
  ])

  let usageBytes: number | null = null
  let quotaBytes: number | null = null
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate()
      usageBytes = typeof est.usage === 'number' ? est.usage : null
      quotaBytes = typeof est.quota === 'number' ? est.quota : null
    } catch {
      // Ignore unsupported estimate errors
    }
  }

  const questionIds = new Set(questions.map((q) => q.id))
  const partMap = new Map(parts.map((p) => [p.id, p]))
  const dayMap = new Map(days.map((d) => [d.date, d]))

  // 1. Orphaned answers
  const orphanedAnswers: OrphanedAnswerIssue[] = []
  for (const ans of answers) {
    if (!partMap.has(ans.partId)) {
      orphanedAnswers.push({
        answerId: ans.id,
        date: ans.date,
        questionId: ans.questionId,
        partId: ans.partId,
        reason: 'missing_part',
      })
    } else if (!questionIds.has(ans.questionId)) {
      orphanedAnswers.push({
        answerId: ans.id,
        date: ans.date,
        questionId: ans.questionId,
        partId: ans.partId,
        reason: 'missing_question',
      })
    } else if (!dayMap.has(ans.date)) {
      orphanedAnswers.push({
        answerId: ans.id,
        date: ans.date,
        questionId: ans.questionId,
        partId: ans.partId,
        reason: 'missing_day',
      })
    }
  }

  // 2. Missing/empty photo blobs & estimate binary sizes
  const missingPhotoBlobs: MissingPhotoIssue[] = []
  let photoBytes = 0
  for (const ch of chapters) {
    const chPhotos = ch.photos || []
    for (let idx = 0; idx < chPhotos.length; idx++) {
      const blob = chPhotos[idx]
      if (!isBlobLike(blob) || blob.size <= 0) {
        missingPhotoBlobs.push({
          chapterId: ch.id,
          chapterTitle: ch.title || ch.id,
          photoIndex: idx,
          reason: !isBlobLike(blob) ? 'Photo is not a valid Blob' : 'Photo Blob has 0 bytes',
        })
      } else {
        photoBytes += blob.size
      }
    }
  }

  // 3. Invalid or out-of-range values
  const invalidValues: InvalidValueIssue[] = []
  for (const day of days) {
    if (
      day.overallRating !== undefined &&
      day.overallRating !== null &&
      (typeof day.overallRating !== 'number' ||
        !Number.isFinite(day.overallRating) ||
        day.overallRating < 0 ||
        day.overallRating > 10)
    ) {
      invalidValues.push({
        entity: 'day',
        id: day.date,
        date: day.date,
        detail: `Overall rating out of range (0-10): ${String(day.overallRating)}`,
      })
    }
    if (![0, 1, 2, 3].includes(day.memorability)) {
      invalidValues.push({
        entity: 'day',
        id: day.date,
        date: day.date,
        detail: `Invalid memorability value: ${String(day.memorability)}`,
      })
    }
  }

  for (const ans of answers) {
    const part = partMap.get(ans.partId)
    if (!part) continue

    if (part.kind === 'scale') {
      if (ans.value !== undefined && ans.value !== null) {
        const cfg = (part.config || {}) as Partial<ScaleConfig>
        const min = typeof cfg.min === 'number' ? cfg.min : 0
        const max = typeof cfg.max === 'number' ? cfg.max : 10
        if (typeof ans.value !== 'number' || !Number.isFinite(ans.value) || ans.value < min || ans.value > max) {
          invalidValues.push({
            entity: 'answer',
            id: ans.id,
            date: ans.date,
            detail: `${part.label}: scale value ${String(ans.value)} outside [${min}, ${max}]`,
          })
        }
      }
    } else if (part.kind === 'number') {
      if (ans.value !== undefined && ans.value !== null) {
        if (typeof ans.value !== 'number' || !Number.isFinite(ans.value)) {
          invalidValues.push({
            entity: 'answer',
            id: ans.id,
            date: ans.date,
            detail: `${part.label}: invalid numeric value ${String(ans.value)}`,
          })
        }
      }
    } else if (part.kind === 'timerange' && ans.value !== undefined && ans.value !== null) {
      const tr = ans.value as Partial<TimeRangeValue>
      if (
        typeof tr !== 'object' ||
        typeof tr.start !== 'string' ||
        typeof tr.end !== 'string' ||
        !HHMM_RE.test(tr.start) ||
        !HHMM_RE.test(tr.end)
      ) {
        invalidValues.push({
          entity: 'answer',
          id: ans.id,
          date: ans.date,
          detail: `${part.label}: invalid time range value`,
        })
      }
    }
  }

  // 4. Duplicate records
  const duplicateRecords: DuplicateRecordIssue[] = []
  const ansGroups = new Map<string, Answer[]>()
  for (const ans of answers) {
    const k = `${ans.date}|${ans.questionId}|${ans.partId}|${ans.instance}`
    const arr = ansGroups.get(k) || []
    arr.push(ans)
    ansGroups.set(k, arr)
  }
  for (const [k, group] of ansGroups.entries()) {
    if (group.length > 1) {
      duplicateRecords.push({
        table: 'answers',
        key: k,
        duplicateIds: group.map((a) => a.id),
      })
    }
  }

  const linkGroups = new Map<string, string[]>()
  for (const lnk of answerLinks) {
    const k = `${lnk.date}|${lnk.answerId}|${lnk.libraryId}|${lnk.itemId}`
    const arr = linkGroups.get(k) || []
    arr.push(lnk.id)
    linkGroups.set(k, arr)
  }
  for (const [k, ids] of linkGroups.entries()) {
    if (ids.length > 1) {
      duplicateRecords.push({
        table: 'answerLinks',
        key: k,
        duplicateIds: ids,
      })
    }
  }

  // 5. Missing days in the active open chapter (oldest-to-today, returned newest-first)
  const openChapter = chapters.find((c) => c.status === 'open') || null
  const missingDays: string[] = []
  if (openChapter) {
    const upperBound =
      openChapter.plannedEndDate < todayDateStr ? openChapter.plannedEndDate : todayDateStr
    let cursor = openChapter.startDate
    let guard = 0
    while (cursor <= upperBound && guard < 120) {
      if (!dayMap.has(cursor)) {
        missingDays.push(cursor)
      }
      cursor = addDays(cursor, 1)
      guard++
    }
    missingDays.reverse()
  }

  // Approximate JSON payload size + photo blob bytes
  const jsonBytes =
    JSON.stringify({
      questions,
      parts,
      chapters: chapters.map((c) => ({ ...c, photos: undefined })),
      days,
      answers,
      answerLinks,
      cycles,
      chapterAnswers,
      stickers: stickers.map((s) => ({ ...s, blob: typeof s.blob === 'string' ? s.blob : undefined })),
    }).length + photoBytes

  const totalRecords =
    chapters.length +
    days.length +
    answers.length +
    answerLinks.length +
    questions.length +
    parts.length +
    cycles.length +
    chapterAnswers.length +
    stickers.length

  const totalIssues =
    orphanedAnswers.length +
    missingPhotoBlobs.length +
    invalidValues.length +
    duplicateRecords.length

  return {
    checkedAt: Date.now(),
    isPersisted,
    backupStatus,
    storageEstimate: {
      usageBytes,
      quotaBytes,
      estimatedRecordBytes: jsonBytes,
      totalRecords,
    },
    orphanedAnswers,
    missingPhotoBlobs,
    invalidValues,
    duplicateRecords,
    missingDays,
    openChapterId: openChapter?.id ?? null,
    totalIssues,
  }
}

/**
 * Removes exact duplicate active answers/answerLinks after taking a safety snapshot first (B7).
 */
export async function fixDuplicateRecords(
  db: TrinqleDB = defaultDb,
  snapshotDb: SnapshotsDB = defaultSnapshotsDb
): Promise<number> {
  await createSafetySnapshot('before_health_fix', 'Before deduplicating records', db, snapshotDb)

  const [answers, links] = await Promise.all([
    db.answers.filter((a) => !a.deletedAt).toArray(),
    db.answerLinks.filter((l) => !l.deletedAt).toArray(),
  ])

  const idsToDeleteAnswers: string[] = []
  const seenAnswers = new Map<string, Answer>()
  for (const a of answers) {
    const key = `${a.date}|${a.questionId}|${a.partId}|${a.instance}`
    const prev = seenAnswers.get(key)
    if (!prev) {
      seenAnswers.set(key, a)
    } else if ((a.updatedAt ?? 0) > (prev.updatedAt ?? 0)) {
      idsToDeleteAnswers.push(prev.id)
      seenAnswers.set(key, a)
    } else {
      idsToDeleteAnswers.push(a.id)
    }
  }

  const idsToDeleteLinks: string[] = []
  const seenLinks = new Set<string>()
  for (const lnk of links) {
    const key = `${lnk.date}|${lnk.answerId}|${lnk.libraryId}|${lnk.itemId}`
    if (seenLinks.has(key)) idsToDeleteLinks.push(lnk.id)
    else seenLinks.add(key)
  }

  if (idsToDeleteAnswers.length || idsToDeleteLinks.length) {
    await db.runBypassingClosedGuard(() =>
      db.transaction('rw', [db.answers, db.answerLinks], async () => {
        if (idsToDeleteAnswers.length) await db.answers.bulkDelete(idsToDeleteAnswers)
        if (idsToDeleteLinks.length) await db.answerLinks.bulkDelete(idsToDeleteLinks)
      })
    )
  }

  return idsToDeleteAnswers.length + idsToDeleteLinks.length
}

/**
 * Removes orphaned answers after taking a safety snapshot first (B7).
 */
export async function fixOrphanedAnswers(
  db: TrinqleDB = defaultDb,
  snapshotDb: SnapshotsDB = defaultSnapshotsDb
): Promise<number> {
  await createSafetySnapshot('before_health_fix', 'Before removing orphaned answers', db, snapshotDb)
  const report = await runDataHealthCheck(db)
  if (report.orphanedAnswers.length === 0) return 0

  const ids = report.orphanedAnswers.map((o) => o.answerId)
  await db.runBypassingClosedGuard(() => db.answers.bulkDelete(ids))
  return ids.length
}
