import Dexie, { type Table } from 'dexie'
import { db as defaultDb, type TrinqleDB } from '../data/db'
import { generateUUIDv7 } from './ids'
import {
  buildFullBackupZipBytes,
  importFullBackupZip,
  type FullBackupCounts,
} from './fullBackup'

export const MAX_SAFETY_SNAPSHOTS = 5

export type SnapshotReason =
  | 'before_delete_all'
  | 'before_import_replace'
  | 'before_chapter_close'
  | 'before_health_fix'
  | 'manual'

export interface SafetySnapshotRecord {
  id: string
  reason: SnapshotReason
  label: string
  createdAt: number
  chaptersCount: number
  daysCount: number
  answersCount: number
  sizeBytes: number
  payload: Uint8Array
}

export type SafetySnapshotSummary = Omit<SafetySnapshotRecord, 'payload'>

export class SnapshotsDB extends Dexie {
  snapshots!: Table<SafetySnapshotRecord, string>

  constructor(name = 'trinqle_snapshots_db') {
    super(name)
    this.version(1).stores({
      snapshots: 'id, createdAt, reason',
    })
  }
}

export const defaultSnapshotsDb = new SnapshotsDB()

/**
 * Saves an automatic verified full-database safety snapshot in a separate IndexedDB,
 * keeping at most MAX_SAFETY_SNAPSHOTS (5) most recent snapshots.
 */
export async function createSafetySnapshot(
  reason: SnapshotReason,
  label: string,
  sourceDb: TrinqleDB = defaultDb,
  snapshotDb: SnapshotsDB = defaultSnapshotsDb
): Promise<SafetySnapshotSummary> {
  const { zipBytes, preview } = await buildFullBackupZipBytes(sourceDb)
  const createdAt = Date.now()
  const record: SafetySnapshotRecord = {
    id: generateUUIDv7(createdAt),
    reason,
    label,
    createdAt,
    chaptersCount: preview.manifest.counts.chapters,
    daysCount: preview.manifest.counts.days,
    answersCount: preview.manifest.counts.answers,
    sizeBytes: zipBytes.byteLength,
    payload: zipBytes,
  }

  await snapshotDb.snapshots.put(record)

  // Retain only the newest MAX_SAFETY_SNAPSHOTS
  const ordered = await snapshotDb.snapshots.orderBy('createdAt').reverse().toArray()
  if (ordered.length > MAX_SAFETY_SNAPSHOTS) {
    const staleIds = ordered.slice(MAX_SAFETY_SNAPSHOTS).map((s) => s.id)
    await snapshotDb.snapshots.bulkDelete(staleIds)
  }

  const { payload: _omit, ...summary } = record
  return summary
}

/**
 * Lists saved safety snapshots ordered newest-first.
 */
export async function listSafetySnapshots(
  snapshotDb: SnapshotsDB = defaultSnapshotsDb
): Promise<SafetySnapshotSummary[]> {
  const all = await snapshotDb.snapshots.orderBy('createdAt').reverse().toArray()
  return all.map(({ payload: _omit, ...summary }) => summary)
}

/**
 * Restores a safety snapshot into the main database atomically.
 */
export async function restoreSafetySnapshot(
  snapshotId: string,
  targetDb: TrinqleDB = defaultDb,
  snapshotDb: SnapshotsDB = defaultSnapshotsDb
): Promise<FullBackupCounts> {
  const record = await snapshotDb.snapshots.get(snapshotId)
  if (!record) {
    throw new Error('Safety snapshot not found')
  }
  return importFullBackupZip(record.payload, targetDb, { mode: 'replace' })
}

export async function deleteSafetySnapshot(
  snapshotId: string,
  snapshotDb: SnapshotsDB = defaultSnapshotsDb
): Promise<void> {
  await snapshotDb.snapshots.delete(snapshotId)
}
