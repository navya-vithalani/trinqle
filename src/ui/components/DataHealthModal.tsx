import React, { useEffect, useState } from 'react'
import {
  X,
  Activity,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Wrench,
  RefreshCw,
} from 'lucide-react'
import {
  runDataHealthCheck,
  fixDuplicateRecords,
  fixOrphanedAnswers,
  type DataHealthReport,
} from '../../core/healthCheck'

interface DataHealthModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenMissingDay?: (date: string) => void
  onFixed?: (msg: string) => void
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export const DataHealthModal: React.FC<DataHealthModalProps> = ({
  isOpen,
  onClose,
  onOpenMissingDay,
  onFixed,
}) => {
  const [report, setReport] = useState<DataHealthReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(false)

  const scan = async () => {
    setLoading(true)
    try {
      const res = await runDataHealthCheck()
      setReport(res)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      void scan()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleFixDuplicates = async () => {
    setFixing(true)
    try {
      const removed = await fixDuplicateRecords()
      onFixed?.(`Saved safety snapshot & removed ${removed} duplicate record(s)`)
      await scan()
    } finally {
      setFixing(false)
    }
  }

  const handleFixOrphans = async () => {
    setFixing(true)
    try {
      const removed = await fixOrphanedAnswers()
      onFixed?.(`Saved safety snapshot & removed ${removed} orphaned answer(s)`)
      await scan()
    } finally {
      setFixing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--color-surface)] w-full max-w-md rounded-[var(--radius-l)] border-2 border-[var(--color-line)] shadow-2xl p-4 space-y-3 max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-2.5">
          <div className="flex items-center space-x-2">
            <Activity size={18} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-sm text-[var(--color-ink)]">Data Health Check</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={scan}
              disabled={loading}
              className="p-1.5 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-bg)]"
              title="Re-scan database"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-[var(--color-ink-soft)] hover:bg-[var(--color-bg)]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {!report || loading ? (
            <p className="text-center py-8 text-[var(--color-ink-soft)]">
              Scanning local database...
            </p>
          ) : (
            <>
              {/* Summary Status */}
              <div
                className={`p-3 rounded-[var(--radius-m)] border flex items-center gap-2.5 ${
                  report.totalIssues === 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-800'
                }`}
              >
                {report.totalIssues === 0 ? (
                  <CheckCircle2 size={18} className="shrink-0" />
                ) : (
                  <AlertTriangle size={18} className="shrink-0" />
                )}
                <div>
                  <span className="font-bold block">
                    {report.totalIssues === 0
                      ? 'All integrity checks passed'
                      : `${report.totalIssues} data issue(s) found`}
                  </span>
                  <span className="text-[11px] opacity-90">
                    Read-only scan. Any cleanup automatically saves a safety snapshot first.
                  </span>
                </div>
              </div>

              {/* Storage & Backup Overview */}
              <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-soft)] flex items-center gap-1">
                    <ShieldCheck size={13} /> Storage Persistence
                  </span>
                  <span
                    className={`font-bold ${
                      report.isPersisted ? 'text-emerald-600' : 'text-amber-700'
                    }`}
                  >
                    {report.isPersisted ? 'Protected' : 'Not protected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-soft)]">Last Backup</span>
                  <span className="font-semibold text-[var(--color-ink)]">
                    {report.backupStatus.lastBackupDate
                      ? `${report.backupStatus.lastBackupDate} (${report.backupStatus.nightsSinceBackup} nights since)`
                      : `Never (${report.backupStatus.totalActiveDays} nights unbacked)`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-soft)]">Database Size</span>
                  <span className="font-semibold text-[var(--color-ink)]">
                    {formatBytes(report.storageEstimate.estimatedRecordBytes)} ({report.storageEstimate.totalRecords} records)
                  </span>
                </div>
                {report.storageEstimate.usageBytes !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-soft)]">Origin Quota Usage</span>
                    <span className="font-mono text-[11px] text-[var(--color-ink-soft)]">
                      {formatBytes(report.storageEstimate.usageBytes)}
                      {report.storageEstimate.quotaBytes
                        ? ` / ${formatBytes(report.storageEstimate.quotaBytes)}`
                        : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Diagnostics Breakdown */}
              <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Orphaned answers</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {report.orphanedAnswers.length}
                  </span>
                </div>
                {report.orphanedAnswers.length > 0 && (
                  <button
                    type="button"
                    disabled={fixing}
                    onClick={handleFixOrphans}
                    className="w-full py-1.5 px-3 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Wrench size={12} />
                    <span>Snapshot & Clean Orphaned Answers</span>
                  </button>
                )}

                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Duplicate records</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {report.duplicateRecords.length}
                  </span>
                </div>
                {report.duplicateRecords.length > 0 && (
                  <button
                    type="button"
                    disabled={fixing}
                    onClick={handleFixDuplicates}
                    className="w-full py-1.5 px-3 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Wrench size={12} />
                    <span>Snapshot & Deduplicate Records</span>
                  </button>
                )}

                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Missing photo blobs</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {report.missingPhotoBlobs.length}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[var(--color-ink-soft)]">Invalid / out-of-range values</span>
                  <span className="font-bold text-[var(--color-ink)]">
                    {report.invalidValues.length}
                  </span>
                </div>
                {report.invalidValues.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-700">
                    {report.invalidValues.slice(0, 6).map((v) => (
                      <li key={v.id}>
                        {v.date}: {v.detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Missing Days List */}
              <div className="p-3 rounded-[var(--radius-m)] bg-[var(--color-bg)] border border-[var(--color-line)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                    <Calendar size={13} className="text-[var(--color-accent)]" />
                    Missing Nights (Active Chapter)
                  </span>
                  <span className="text-[11px] text-[var(--color-ink-soft)]">
                    {report.missingDays.length}
                  </span>
                </div>

                {report.missingDays.length === 0 ? (
                  <p className="text-[11px] text-[var(--color-ink-soft)]">
                    Every night in the current chapter has an entry.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {report.missingDays.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          onClose()
                          onOpenMissingDay?.(d)
                        }}
                        className="px-2.5 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] text-[11px] font-semibold text-[var(--color-accent)] hover:border-[var(--color-accent)] active:scale-95"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
