import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  RefreshCw,
  Star,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertCircle,
  Zap,
} from 'lucide-react'
import {
  InsightRepository,
  DayRepository,
  FormRepository,
  LibraryRepository,
} from '../../data/repositories'
import { generateInsights } from '../../core/engine/generator'
import type { Run, Insight } from '../../data/types'

interface InsightsScreenProps {
  onNavigateToProfileBrowse?: (date: string) => void
}

type FilterTab = 'active' | 'rated' | 'discarded'

export const InsightsScreen: React.FC<InsightsScreenProps> = ({
  onNavigateToProfileBrowse,
}) => {
  const [runs, setRuns] = useState<Run[]>([])
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [filterTab, setFilterTab] = useState<FilterTab>('active')
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [knownSignatures, setKnownSignatures] = useState<Set<string>>(new Set())

  const insightRepo = new InsightRepository()
  const dayRepo = new DayRepository()
  const formRepo = new FormRepository()
  const libRepo = new LibraryRepository()

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const allRuns = await insightRepo.getAllRuns()
      setRuns(allRuns)

      const known = await insightRepo.getKnownSignatures()
      setKnownSignatures(new Set(known))

      if (allRuns.length > 0) {
        const activeRun = selectedRun
          ? allRuns.find((r) => r.id === selectedRun.id) || allRuns[0]
          : allRuns[0]
        setSelectedRun(activeRun)
        const runInsights = await insightRepo.getInsightsForRun(activeRun.id)
        setInsights(runInsights)
      } else {
        setSelectedRun(null)
        setInsights([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSelectRun = async (runId: string) => {
    const run = runs.find((r) => r.id === runId)
    if (!run) return
    setSelectedRun(run)
    const runInsights = await insightRepo.getInsightsForRun(run.id)
    setInsights(runInsights)
  }

  const handleGenerate = async (trigger: 'manual' | 'sunday' = 'manual') => {
    setIsGenerating(true)
    try {
      const days = await dayRepo.getAllDays()
      if (days.length === 0) {
        showToast('No logged days yet. Fill a few nights first.')
        return
      }

      const answers = await formRepo.getAllAnswers()
      const questions = await formRepo.getQuestions()
      const parts = await formRepo.getParts()
      const libraries = await libRepo.getAllLibraries()
      const items = await libRepo.getAllItems()
      const answerLinks = await formRepo.getAllAnswerLinks()
      const discardedSignatures = await insightRepo.getDiscardedSignatures()

      const result = generateInsights({
        days,
        answers,
        questions,
        parts,
        answerLinks,
        items,
        libraries,
        options: {
          bar: 6.5,
          minShow: 20,
          minN: 5,
          discardedSignatures,
        },
      })

      // Format for storage
      const runData: Omit<Run, 'id' | 'createdAt' | 'updatedAt'> = {
        at: Date.now(),
        trigger,
        windowLabel: result.windowLabel,
        windowStart: result.windowStart,
        windowEnd: result.windowEnd,
        nGenerated: result.nGenerated,
        nAboveBar: result.nAboveBar,
        bar: result.bar,
      }

      const insightsData = result.insights.map((cand) => ({
        runId: '', // populated in repository
        signature: cand.signature,
        windows: [result.windowLabel],
        payload: {
          headline: cand.headline,
          facts: cand.facts,
          evidenceDays: cand.evidenceDays.map((e) => ({
            date: e.date,
            title: e.title,
            oneliner: e.oneliner,
          })),
        },
        sureness: cand.sureness,
        surprise: cand.surprise,
        score: cand.score,
        status: 'active' as const,
      }))

      const { run: savedRun } = await insightRepo.saveRun(runData, insightsData)
      showToast(`Generated ${result.insights.length} insights (${result.nAboveBar} above bar 6.5)`)
      await loadData()
      setSelectedRun(savedRun)
    } catch (err) {
      console.error('Insights generation error:', err)
      showToast('Error generating insights')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRate = async (insightId: string, rating: 1 | 2 | 3 | 4 | 5) => {
    await insightRepo.rateInsight(insightId, rating)
    setInsights((prev) =>
      prev.map((ins) => (ins.id === insightId ? { ...ins, rating } : ins))
    )
  }

  const handleDiscard = async (insightId: string) => {
    await insightRepo.discardInsight(insightId)
    setInsights((prev) =>
      prev.map((ins) => (ins.id === insightId ? { ...ins, status: 'discarded' } : ins))
    )
    showToast('Insight discarded (suppressed in future runs)')
  }

  const handleUndoDiscard = async (insightId: string) => {
    await insightRepo.undoDiscardInsight(insightId)
    setInsights((prev) =>
      prev.map((ins) => (ins.id === insightId ? { ...ins, status: 'active' } : ins))
    )
    showToast('Insight restored to active')
  }

  const toggleEvidence = (id: string) => {
    setExpandedEvidence((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const activeInsights = insights.filter((i) => i.status === 'active')
  const ratedInsights = insights.filter((i) => i.status === 'active' && i.rating)
  const discardedInsights = insights.filter((i) => i.status === 'discarded')

  const displayedInsights =
    filterTab === 'active'
      ? activeInsights
      : filterTab === 'rated'
        ? ratedInsights
        : discardedInsights

  return (
    <div className="space-y-4 pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-ink)] text-white text-xs font-semibold py-1.5 px-4 rounded-full shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Top Header Card */}
      <div className="sticker-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles size={20} className="text-[var(--color-accent)]" />
            <div>
              <h2 className="font-bold text-sm text-[var(--color-ink)]">Insights Engine</h2>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                Statistical correlations, habits, streaks, and anomalies
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleGenerate('manual')}
            disabled={isGenerating}
            className="px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-[var(--radius-m)] text-xs font-bold hover:brightness-105 active:scale-95 transition-all flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
          >
            {isGenerating ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Zap size={14} />
            )}
            <span>{isGenerating ? 'Analyzing...' : 'Generate now'}</span>
          </button>
        </div>

        {/* Run Selector & Metadata */}
        {runs.length > 0 && selectedRun && (
          <div className="pt-2 border-t border-[var(--color-line)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-[var(--color-ink-soft)] font-medium">Run:</span>
              <select
                value={selectedRun.id}
                onChange={(e) => handleSelectRun(e.target.value)}
                className="bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] font-semibold rounded-lg px-2 py-1 text-xs outline-none"
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.at).toLocaleDateString()} ({r.trigger}) - {r.nAboveBar} above bar
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-[var(--color-ink-soft)]">
              <span className="px-2 py-0.5 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)] font-semibold">
                {selectedRun.nAboveBar} above bar ({selectedRun.bar})
              </span>
              <span>{selectedRun.nGenerated} evaluated</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      {insights.length > 0 && (
        <div className="flex items-center space-x-2 border-b border-[var(--color-line)] pb-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilterTab('active')}
            className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1 ${
              filterTab === 'active'
                ? 'bg-[var(--color-accent)] text-white font-bold'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)]'
            }`}
          >
            <span>Active</span>
            <span className="text-[10px] opacity-80">({activeInsights.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('rated')}
            className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1 ${
              filterTab === 'rated'
                ? 'bg-[var(--color-accent)] text-white font-bold'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)]'
            }`}
          >
            <span>Rated</span>
            <span className="text-[10px] opacity-80">({ratedInsights.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('discarded')}
            className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1 ${
              filterTab === 'discarded'
                ? 'bg-[var(--color-accent)] text-white font-bold'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-surface)]'
            }`}
          >
            <span>Discarded</span>
            <span className="text-[10px] opacity-80">({discardedInsights.length})</span>
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="sticker-card p-8 text-center text-xs text-[var(--color-ink-soft)]">
          <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-[var(--color-accent)]" />
          Loading statistical findings...
        </div>
      )}

      {/* Empty State: No Runs */}
      {!isLoading && runs.length === 0 && (
        <div className="sticker-card p-6 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
            <Sparkles size={24} />
          </div>
          <h3 className="font-bold text-sm text-[var(--color-ink)]">No Insights Runs Yet</h3>
          <p className="text-xs text-[var(--color-ink-soft)] max-w-xs mx-auto">
            The Insights Engine runs offline Mann-Whitney rank tests, Spearman correlations, CUSUM step shifts, and Benjamini-Hochberg FDR correction.
          </p>
          <button
            type="button"
            onClick={() => handleGenerate('manual')}
            disabled={isGenerating}
            className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-[var(--radius-m)] text-xs font-bold hover:brightness-105 active:scale-95 transition-all shadow-xs"
          >
            Generate first run
          </button>
        </div>
      )}

      {/* Empty State: Filter Tab */}
      {!isLoading && runs.length > 0 && displayedInsights.length === 0 && (
        <div className="sticker-card p-6 text-center text-xs text-[var(--color-ink-soft)] space-y-1">
          <AlertCircle size={20} className="mx-auto text-[var(--color-ink-soft)]" />
          <p className="font-semibold text-[var(--color-ink)]">No insights in this view</p>
          <p>
            {filterTab === 'rated'
              ? 'Rate active insights using the 1-5 star buttons below.'
              : filterTab === 'discarded'
                ? 'Discarded insights will be listed here.'
                : 'No active insights found.'}
          </p>
        </div>
      )}

      {/* Insights List */}
      {!isLoading && displayedInsights.length > 0 && (
        <div className="space-y-3">
          {displayedInsights.map((ins, idx) => {
            const isAboveBar = ins.score >= 6.5
            const isEvidenceOpen = !!expandedEvidence[ins.id]
            const payload = ins.payload as {
              headline?: string
              facts: string[]
              evidenceDays?: Array<{ date: string; title?: string; oneliner?: string }>
            }
            const evidenceDays = payload.evidenceDays || []

            return (
              <div
                key={ins.id}
                className={`sticker-card p-4 space-y-3 transition-all ${
                  ins.status === 'discarded' ? 'opacity-70 bg-neutral-50 dark:bg-neutral-900' : ''
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[var(--color-ink-soft)]">
                      #{idx + 1}
                    </span>

                    {/* Score badge */}
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        isAboveBar
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 border-neutral-300'
                      }`}
                    >
                      Score {ins.score.toFixed(1)}
                    </span>

                    {/* Still true badge (TRD 7) */}
                    {knownSignatures.has(ins.signature) && runs.length > 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200">
                        Still true
                      </span>
                    )}

                    {/* Sureness & Surprise pills */}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink-soft)]">
                      Sureness: {ins.sureness.toFixed(1)}/10
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink-soft)]">
                      Surprise: {ins.surprise.toFixed(1)}/10
                    </span>
                  </div>

                  {/* Discard / Restore Action */}
                  {ins.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => handleDiscard(ins.id)}
                      className="p-1 text-[var(--color-ink-soft)] hover:text-red-500 rounded transition-colors"
                      title="Discard insight (suppress signature)"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUndoDiscard(ins.id)}
                      className="px-2 py-0.5 text-xs text-[var(--color-accent)] font-semibold hover:underline flex items-center gap-1"
                    >
                      <RotateCcw size={12} />
                      <span>Undo</span>
                    </button>
                  )}
                </div>

                {/* Headline */}
                <h4 className="font-bold text-sm text-[var(--color-ink)] leading-snug">
                  {payload.headline || payload.facts[0] || 'Insight Finding'}
                </h4>

                {/* Compositional Body Facts */}
                <div className="space-y-1 text-xs text-[var(--color-ink-soft)] leading-relaxed">
                  {payload.facts.map((fact, fIdx) => (
                    <p key={fIdx}>{fact}</p>
                  ))}
                </div>

                {/* Evidence Drawer */}
                {evidenceDays.length > 0 && (
                  <div className="pt-2 border-t border-[var(--color-line)]">
                    <button
                      type="button"
                      onClick={() => toggleEvidence(ins.id)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                    >
                      <span className="flex items-center gap-1">
                        <Calendar size={13} />
                        Evidence Days ({evidenceDays.length})
                      </span>
                      {isEvidenceOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {isEvidenceOpen && (
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-[var(--color-line)] text-xs">
                        {evidenceDays.map((ed) => (
                          <div
                            key={ed.date}
                            onClick={() => onNavigateToProfileBrowse?.(ed.date)}
                            className="cursor-pointer hover:bg-[var(--color-bg)] p-1 rounded transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[var(--color-accent)]">{ed.date}</span>
                              {ed.title && (
                                <span className="text-[11px] font-semibold text-[var(--color-ink)] truncate max-w-[180px]">
                                  {ed.title}
                                </span>
                              )}
                            </div>
                            {ed.oneliner && (
                              <p className="text-[11px] text-[var(--color-ink-soft)] italic truncate">
                                "{ed.oneliner}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Rating Bar (1 to 5) */}
                <div className="pt-2 border-t border-[var(--color-line)] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[var(--color-ink-soft)]">
                    {ins.rating ? `Your rating: ${ins.rating}/5` : 'Rate this insight:'}
                  </span>

                  <div className="flex items-center space-x-1">
                    {([1, 2, 3, 4, 5] as const).map((starNum) => {
                      const isFilled = (ins.rating || 0) >= starNum
                      return (
                        <button
                          key={starNum}
                          type="button"
                          onClick={() => handleRate(ins.id, starNum)}
                          className={`p-1 transition-transform active:scale-125 ${
                            isFilled
                              ? 'text-amber-500 fill-amber-500'
                              : 'text-neutral-300 dark:text-neutral-600 hover:text-amber-400'
                          }`}
                          title={`Rate ${starNum} out of 5`}
                        >
                          <Star
                            size={14}
                            className={isFilled ? 'fill-amber-400 text-amber-500' : ''}
                          />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
