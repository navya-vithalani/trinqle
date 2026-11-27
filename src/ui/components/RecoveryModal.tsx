import React, { useEffect, useState } from 'react'
import { X, History, RotateCcw, Trash2, AlertCircle } from 'lucide-react'
import {
  listSafetySnapshots,
  restoreSafetySnapshot,
  deleteSafetySnapshot,
  type SafetySnapshotSummary,
  type SnapshotReason,
} from '../../core/snapshots'

interface RecoveryModalProps {
  isOpen: boolean
  onClose: () => void
  onRestored: (message: string) => void
}

const REASON_LABELS: Record<SnapshotReason, string> = {
  before_delete_all: 'Before Delete All Data',
  before_import_replace: 'Before Import Replace',
  before_chapter_close: 'Before Chapter Close',
  before_health_fix: 'Before Health Check Fix',
  manual: 'Manual Snapshot',
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  isOpen,
  onClose,
  onRestored,
}) => {
  const [snapshots, setSnapshots] = useState<SafetySnapshotSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await listSafetySnapshots()
      setSnapshots(list)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load recovery snapshots')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setConfirmId(null)
      void refresh()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleRestore = async (snap: SafetySnapshotSummary) => {
    setRestoringId(snap.id)
    setError(null)
    try {
      await restoreSafetySnapshot(snap.id)
      onRestored(`Restored snapshot from ${new Date(snap.createdAt).toLocaleString()}`)
      onClose()
      setTimeout(() => window.location.reload(), 900)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Snapshot restore failed')
    } finally {
      setRestoringId(null)
      setConfirmId(null)
    }
  }

  const handleDelete = async (id: string) => {
    await deleteSafetySnapshot(id)
    await refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--color-surface)] w-full max-w-md rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl p-4 space-y-3 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2.5">
          <div className="flex items-center space-x-2">
            <History size={18} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm text-[var(--color-ink)]">
              Recovery Snapshots (Last 5)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-bg)]"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-[11px] text-[var(--color-ink-soft)] leading-relaxed">
          Automatic safety snapshots are saved in a separate local database before Delete All, Import Replace, Chapter Close, and Health fixes.
        </p>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <p className="text-xs text-[var(--color-ink-soft)] text-center py-6">
              Loading snapshots...
            </p>
          ) : snapshots.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--color-ink-soft)] border-2 border-dashed border-[var(--color-line)] rounded-[var(--radius-m)]">
              No automatic safety snapshots yet. One will be captured before any destructive action.
            </div>
          ) : (
            snapshots.map((snap) => (
              <div
                key={snap.id}
                className="p-3 rounded-[var(--radius-m)] border border-[var(--color-line)] bg-[var(--color-bg)] space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-[var(--color-ink)] block">
                      {snap.label || REASON_LABELS[snap.reason]}
                    </span>
                    <span className="text-[10px] text-[var(--color-ink-soft)]">
                      {new Date(snap.createdAt).toLocaleString()} · {REASON_LABELS[snap.reason]}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)] shrink-0">
                    {Math.max(1, Math.round(snap.sizeBytes / 1024))} KB
                  </span>
                </div>

                <div className="text-[11px] text-[var(--color-ink-soft)]">
                  {snap.chaptersCount} chapters · {snap.daysCount} days · {snap.answersCount} answers
                </div>

                {confirmId === snap.id ? (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <p className="text-[11px] font-semibold text-amber-800">
                      Replace current database with this snapshot?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="flex-1 py-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[11px] font-semibold text-[var(--color-ink)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={restoringId === snap.id}
                        onClick={() => handleRestore(snap)}
                        className="flex-1 py-1.5 rounded-full bg-[var(--color-accent)] text-white text-[11px] font-bold disabled:opacity-50"
                      >
                        {restoringId === snap.id ? 'Restoring...' : 'Confirm Restore'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleDelete(snap.id)}
                      className="text-[11px] text-[var(--color-ink-soft)] hover:text-red-600 flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(snap.id)}
                      className="px-3 py-1.5 rounded-full bg-[var(--color-accent)] text-white text-[11px] font-bold flex items-center gap-1 active:scale-95"
                    >
                      <RotateCcw size={12} />
                      <span>Restore</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
