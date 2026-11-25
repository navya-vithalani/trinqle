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
  Lock,
  ArrowLeft,
  SlidersHorizontal,
} from 'lucide-react'
import {
  InsightRepository,
  DayRepository,
  FormRepository,
  LibraryRepository,
  CycleRepository,
  ChapterRepository,
} from '../../data/repositories'
import { runInsightsAsync } from '../../core/engine/workerClient'
import { buildDailyMetricsTable } from '../../core/metrics/calculator'
import { mannWhitneyU, spearmanCorrelation, mean } from '../../core/engine/stats'
import { addDays } from '../../core/logicalDay'
import type { Run, Insight, Chapter, Day, Answer, Question, Part, AnswerLink, Item } from '../../data/types'

interface InsightsScreenProps {
  frozenChapter?: Chapter
  onExitArchive?: () => void
  onNavigateToProfileBrowse?: (date: string) => void
}

type FilterTab = 'active' | 'rated' | 'discarded'
type MainSubTab = 'findings' | 'explore'
type AnalysisWindow = 'all' | 'chapter' | '4weeks' | 'week'

export const InsightsScreen: React.FC<InsightsScreenProps> = ({
  frozenChapter,
  onExitArchive,
  onNavigateToProfileBrowse,
}) => {
  const isArchiveMode = Boolean(frozenChapter)
  const [mainSubTab, setMainSubTab] = useState<MainSubTab>('findings')
  const [analysisWindow, setAnalysisWindow] = useState<AnalysisWindow>('all')
  const [runs, setRuns] = useState<Run[]>([])
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [filterTab, setFilterTab] = useState<FilterTab>('active')
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [knownSignatures, setKnownSignatures] = useState<Set<string>>(new Set())

  // Explore workbench state
  const [exploreData, setExploreData] = useState<{
    days: Day[]
    answers: Answer[]
    questions: Question[]
    parts: Part[]
    answerLinks: AnswerLink[]
    items: Item[]
  } | null>(null)
  const [exploreDriverKey, setExploreDriverKey] = useState<string>('')
  const [exploreOutcomeKey, setExploreOutcomeKey] = useState<string>('derived.overallRating')
  const [exploreLag, setExploreLag] = useState<number>(0)

  const insightRepo = new InsightRepository()
  const dayRepo = new DayRepository()
  const formRepo = new FormRepository()
  const libRepo = new LibraryRepository()
  const cycleRepo = new CycleRepository()
  const chapterRepo = new ChapterRepository()

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const loadData = async (preferredRunId?: string) => {
    setIsLoading(true)
    try {
      if (frozenChapter) {
        const archivedInsights = (frozenChapter.frozen?.insights || []) as Insight[]
        setRuns([])
        setSelectedRun(null)
        setInsights(archivedInsights)
        setKnownSignatures(new Set())
        return
      }

      const [allRuns, known, allDays, allAnswers, allQuestions, allParts, allLinks, allItems] =
        await Promise.all([
          insightRepo.getAllRuns(),
          insightRepo.getKnownSignatures(),
          dayRepo.getAllDays(),
          formRepo.getAllAnswers(),
          formRepo.getQuestions(),
          formRepo.getParts(),
          formRepo.getAllAnswerLinks(),
          libRepo.getAllItems(),
        ])

      setRuns(allRuns)
      setKnownSignatures(new Set(known))
      setExploreData({
        days: allDays,
        answers: allAnswers,
        questions: allQuestions,
        parts: allParts,
        answerLinks: allLinks,
        items: allItems,
      })

      if (allRuns.length > 0) {
        const targetId = preferredRunId ?? selectedRun?.id
        const activeRun = targetId
          ? allRuns.find((r) => r.id === targetId) || allRuns[0]
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
  }, [frozenChapter?.id])

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
      const [allDays, answers, questions, parts, libraries, items, answerLinks, cycles, openChap, discardedSignatures] =
        await Promise.all([
          dayRepo.getAllDays(),
          formRepo.getAllAnswers(),
          formRepo.getQuestions(),
          formRepo.getParts(),
          libRepo.getAllLibraries(),
          libRepo.getAllItems(),
          formRepo.getAllAnswerLinks(),
          cycleRepo.getAllCycles(),
          chapterRepo.getOpenChapter(),
          insightRepo.getDiscardedSignatures(),
        ])

      if (allDays.length === 0) {
        showToast('No logged days yet. Fill a few nights first.')
        return
      }

      const sortedAll = [...allDays].sort((a, b) => a.date.localeCompare(b.date))
      const latestDate = sortedAll[sortedAll.length - 1].date
      let filteredDays = sortedAll
      let windowLabel: string | undefined

      if (analysisWindow === 'week') {
        const cutoff = addDays(latestDate, -6)
        filteredDays = sortedAll.filter((d) => d.date >= cutoff)
        windowLabel = `Last 7 days (${cutoff} to ${latestDate})`
      } else if (analysisWindow === '4weeks') {
        const cutoff = addDays(latestDate, -27)
        filteredDays = sortedAll.filter((d) => d.date >= cutoff)
        windowLabel = `Last 4 weeks (${cutoff} to ${latestDate})`
      } else if (analysisWindow === 'chapter' && openChap) {
        filteredDays = sortedAll.filter((d) => d.chapterId === openChap.id)
        windowLabel = `${openChap.title || 'Open chapter'} (${openChap.startDate} to ${latestDate})`
      }

      if (filteredDays.length === 0) {
        showToast('No logged days in selected window.')
        return
      }

      const allowedDates = new Set(filteredDays.map((d) => d.date))
      const result = await runInsightsAsync({
        days: filteredDays,
        answers: answers.filter((a) => allowedDates.has(a.date)),
        questions,
        parts,
        answerLinks: answerLinks.filter((l) => allowedDates.has(l.date)),
        items,
        libraries,
        cycles,
        options: {
          bar: 6.5,
          minShow: 20,
          minN: 5,
          maxTests: 50000,
          windowLabel,
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
      showToast(
        `Generated ${result.insights.length} insights (${result.nAboveBar} above bar 6.5)${
          result.truncated ? ' · search cap reached' : ''
        }`
      )
      await loadData(savedRun.id)
    } catch (err) {
      console.error('Insights generation error:', err)
      showToast('Error generating insights')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRate = async (insightId: string, rating: 1 | 2 | 3 | 4 | 5) => {
    if (isArchiveMode) return
    await insightRepo.rateInsight(insightId, rating)
    setInsights((prev) =>
      prev.map((ins) => (ins.id === insightId ? { ...ins, rating } : ins))
    )
  }

  const handleDiscard = async (insightId: string) => {
    if (isArchiveMode) return
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

      {/* Archive Mode Banner */}
      {frozenChapter && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--color-surface)] border-2 border-[var(--color-line)] shadow-xs">
          <button
            type="button"
            onClick={onExitArchive}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] hover:underline"
          >
            <ArrowLeft size={16} />
            <span>Exit Archive Mode</span>
          </button>
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-line)] text-[var(--color-ink)]">
            <Lock size={10} /> Frozen Insights ({frozenChapter.title || 'Chapter'})
          </span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="sticker-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Sparkles size={20} className="text-[var(--color-accent)]" />
            <div>
              <h2 className="font-bold text-sm text-[var(--color-ink)]">
                {frozenChapter ? 'Frozen Insights Snapshot' : 'Insights Engine'}
              </h2>
              <p className="text-[11px] text-[var(--color-ink-soft)]">
                {frozenChapter
                  ? 'Preserved discoveries from this chapter closing ceremony'
                  : 'Statistical correlations, cycle patterns, and interactive lag explorer'}
              </p>
            </div>
          </div>

          {!isArchiveMode && mainSubTab === 'findings' && (
            <button
              type="button"
              onClick={() => handleGenerate('manual')}
              disabled={isGenerating}
              className="px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-[var(--radius-m)] text-xs font-bold hover:brightness-105 active:scale-95 transition-all flex items-center space-x-1.5 shadow-xs disabled:opacity-50 shrink-0"
            >
              {isGenerating ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Zap size={14} />
              )}
              <span>{isGenerating ? 'Analyzing...' : 'Generate'}</span>
            </button>
          )}
        </div>

        {/* Findings | Explore Sub-Tabs + Window Selector */}
        {!isArchiveMode && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-line)]">
            <div className="flex p-0.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-line)] text-xs font-bold">
              <button
                type="button"
                onClick={() => setMainSubTab('findings')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  mainSubTab === 'findings'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-ink-soft)]'
                }`}
              >
                Findings
              </button>
              <button
                type="button"
                onClick={() => setMainSubTab('explore')}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                  mainSubTab === 'explore'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-ink-soft)]'
                }`}
              >
                <SlidersHorizontal size={12} />
                <span>Explore</span>
              </button>
            </div>

            {mainSubTab === 'findings' && (
              <select
                value={analysisWindow}
                onChange={(e) => setAnalysisWindow(e.target.value as AnalysisWindow)}
                className="bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] font-semibold rounded-lg px-2 py-1 text-[11px] outline-none"
                title="Analysis time window"
              >
                <option value="all">Window: All Time</option>
                <option value="chapter">Window: Open Chapter</option>
                <option value="4weeks">Window: Last 4 Weeks</option>
                <option value="week">Window: Last 7 Days</option>
              </select>
            )}
          </div>
        )}

        {/* Run Selector & Metadata */}
        {!isArchiveMode && mainSubTab === 'findings' && runs.length > 0 && selectedRun && (
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
                    {new Date(r.at).toLocaleDateString()} ({r.windowLabel || r.trigger}) - {r.nAboveBar} above bar
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

      {/* Interactive Explore Workbench */}
      {!isArchiveMode && mainSubTab === 'explore' && exploreData && (
        <ExploreWorkbench
          data={exploreData}
          driverKey={exploreDriverKey}
          outcomeKey={exploreOutcomeKey}
          lag={exploreLag}
          onChangeDriver={setExploreDriverKey}
          onChangeOutcome={setExploreOutcomeKey}
          onChangeLag={setExploreLag}
        />
      )}

      {/* Filter Tabs */}
      {mainSubTab === 'findings' && !isArchiveMode && insights.length > 0 && (
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
      {mainSubTab === 'findings' && isLoading && (
        <div className="sticker-card p-8 text-center text-xs text-[var(--color-ink-soft)]">
          <RefreshCw size={18} className="animate-spin mx-auto mb-2 text-[var(--color-accent)]" />
          Loading statistical findings...
        </div>
      )}

      {/* Empty State: Archive has no frozen insights */}
      {mainSubTab === 'findings' && !isLoading && isArchiveMode && insights.length === 0 && (
        <div className="sticker-card p-6 text-center space-y-2 text-xs text-[var(--color-ink-soft)]">
          <Lock size={22} className="mx-auto opacity-60" />
          <p className="font-bold text-[var(--color-ink)]">No frozen insights stored</p>
          <p>No insights were frozen when this chapter was closed.</p>
        </div>
      )}

      {/* Empty State: No Runs */}
      {mainSubTab === 'findings' && !isLoading && !isArchiveMode && runs.length === 0 && (
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
      {mainSubTab === 'findings' && !isLoading && !isArchiveMode && runs.length > 0 && displayedInsights.length === 0 && (
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
      {mainSubTab === 'findings' && !isLoading && displayedInsights.length > 0 && (
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
                  {!isArchiveMode &&
                    (ins.status === 'active' ? (
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
                    ))}
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
                {!isArchiveMode && (
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface ExploreWorkbenchProps {
  data: {
    days: Day[]
    answers: Answer[]
    questions: Question[]
    parts: Part[]
    answerLinks: AnswerLink[]
    items: Item[]
  }
  driverKey: string
  outcomeKey: string
  lag: number
  onChangeDriver: (k: string) => void
  onChangeOutcome: (k: string) => void
  onChangeLag: (l: number) => void
}

const ExploreWorkbench: React.FC<ExploreWorkbenchProps> = ({
  data,
  driverKey,
  outcomeKey,
  lag,
  onChangeDriver,
  onChangeOutcome,
  onChangeLag,
}) => {
  const sortedDays = [...data.days].sort((a, b) => a.date.localeCompare(b.date))
  const dates = sortedDays.map((d) => d.date)
  const dayByDate = new Map(sortedDays.map((d) => [d.date, d]))
  const table = buildDailyMetricsTable(sortedDays, data.answers, data.questions, data.parts)
  const rowsByDate = new Map(table.rows.map((r) => [r.date, r]))

  // Build library item usage map
  const itemDates = new Map<string, Set<string>>()
  for (const l of data.answerLinks) {
    if (!itemDates.has(l.itemId)) itemDates.set(l.itemId, new Set())
    itemDates.get(l.itemId)!.add(l.date)
  }

  type SeriesOption = {
    key: string
    label: string
    kind: 'binary' | 'numeric'
    values: Array<number | null>
  }

  const driverOptions: SeriesOption[] = []
  const outcomeOptions: SeriesOption[] = [
    {
      key: 'derived.overallRating',
      label: 'Overall Day Rating (/10)',
      kind: 'numeric',
      values: dates.map((d) => dayByDate.get(d)?.overallRating ?? null),
    },
    {
      key: 'derived.memorability',
      label: 'Day Memorability (0..3)',
      kind: 'numeric',
      values: dates.map((d) => dayByDate.get(d)?.memorability ?? null),
    },
  ]

  for (const m of table.metrics) {
    const vals = dates.map((d) => rowsByDate.get(d)?.values[m.key] ?? null)
    if (m.partKind === 'scale' || m.partKind === 'number' || m.partKind === 'timerange') {
      const opt: SeriesOption = {
        key: m.key,
        label: `${m.questionLabel}: ${m.label}${m.unit ? ` (${m.unit})` : ''}`,
        kind: 'numeric',
        values: vals,
      }
      driverOptions.push(opt)
      outcomeOptions.push(opt)
    } else if (m.partKind === 'yesno' || m.metric === 'done' || m.metric === 'written') {
      driverOptions.push({
        key: m.key,
        label: `${m.questionLabel}: ${m.label}`,
        kind: 'binary',
        values: vals.map((v) => (v === null ? null : v > 0 ? 1 : 0)),
      })
    }
  }

  for (const item of data.items) {
    if (item.deletedAt) continue
    const dSet = itemDates.get(item.id)
    if (dSet && dSet.size >= 2) {
      driverOptions.push({
        key: `item:${item.id}`,
        label: `Item: ${item.name} (${dSet.size}d)`,
        kind: 'binary',
        values: dates.map((d) => (dSet.has(d) ? 1 : 0)),
      })
    }
  }

  const selectedDriver = driverOptions.find((o) => o.key === driverKey) || driverOptions[0]
  const selectedOutcome =
    outcomeOptions.find((o) => o.key === outcomeKey) || outcomeOptions[0]

  const pairs: Array<{ x: number; y: number; date: string }> = []
  if (selectedDriver && selectedOutcome) {
    for (let i = 0; i < dates.length - lag; i++) {
      const xv = selectedDriver.values[i]
      const yv = selectedOutcome.values[i + lag]
      if (xv !== null && yv !== null) {
        pairs.push({ x: xv, y: yv, date: dates[i] })
      }
    }
  }

  // Compute summary stats
  let statsNode: React.ReactNode = null
  let chartNode: React.ReactNode = null

  if (!selectedDriver || !selectedOutcome || pairs.length < 3) {
    statsNode = (
      <p className="text-xs text-[var(--color-ink-soft)]">
        Need at least 3 paired days to compute statistics and plot points.
      </p>
    )
  } else if (selectedDriver.kind === 'binary') {
    const g1 = pairs.filter((p) => p.x > 0).map((p) => p.y)
    const g0 = pairs.filter((p) => p.x === 0).map((p) => p.y)
    if (g1.length > 0 && g0.length > 0) {
      const mwu = mannWhitneyU(g1, g0)
      const m1 = mean(g1)
      const m0 = mean(g0)
      const diff = m1 - m0
      statsNode = (
        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-[var(--color-bg)] p-2.5 rounded-xl">
          <div>
            <span className="text-[10px] text-[var(--color-ink-soft)] block">When Yes ({g1.length}d)</span>
            <span className="font-bold text-[var(--color-ink)]">{m1.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--color-ink-soft)] block">When No ({g0.length}d)</span>
            <span className="font-bold text-[var(--color-ink)]">{m0.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[10px] text-[var(--color-ink-soft)] block">Diff / p-value</span>
            <span className="font-bold text-[var(--color-accent)]">
              {diff >= 0 ? '+' : ''}
              {diff.toFixed(2)} (p={mwu.pValue.toFixed(3)})
            </span>
          </div>
        </div>
      )

      const allY = pairs.map((p) => p.y)
      const minY = Math.min(...allY)
      const maxY = Math.max(...allY, minY + 1)
      const yToSvg = (v: number) => 130 - ((v - minY) / (maxY - minY || 1)) * 100

      chartNode = (
        <svg viewBox="0 0 300 155" className="w-full h-40 bg-[var(--color-bg)] rounded-xl p-1">
          <line x1="40" y1="20" x2="40" y2="135" stroke="var(--color-line)" strokeWidth="1" />
          <text x="8" y="32" fontSize="9" fill="var(--color-ink-soft)">{maxY.toFixed(1)}</text>
          <text x="8" y="132" fontSize="9" fill="var(--color-ink-soft)">{minY.toFixed(1)}</text>
          {/* No group */}
          <line x1="75" x2="135" y1={yToSvg(m0)} y2={yToSvg(m0)} stroke="var(--color-ink-soft)" strokeWidth="2.5" />
          {g0.slice(0, 60).map((val, idx) => (
            <circle
              key={`no-${idx}`}
              cx={90 + ((idx * 17) % 32)}
              cy={yToSvg(val)}
              r="3"
              fill="var(--color-ink-soft)"
              opacity="0.55"
            />
          ))}
          <text x="105" y="148" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--color-ink-soft)">
            No / Absent
          </text>
          {/* Yes group */}
          <line x1="185" x2="245" y1={yToSvg(m1)} y2={yToSvg(m1)} stroke="var(--color-accent)" strokeWidth="2.5" />
          {g1.slice(0, 60).map((val, idx) => (
            <circle
              key={`yes-${idx}`}
              cx={200 + ((idx * 17) % 32)}
              cy={yToSvg(val)}
              r="3"
              fill="var(--color-accent)"
              opacity="0.7"
            />
          ))}
          <text x="215" y="148" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--color-accent)">
            Yes / Present
          </text>
        </svg>
      )
    }
  } else {
    const xs = pairs.map((p) => p.x)
    const ys = pairs.map((p) => p.y)
    const sp = spearmanCorrelation(xs, ys)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs, minX + 1)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys, minY + 1)
    const xToSvg = (v: number) => 42 + ((v - minX) / (maxX - minX || 1)) * 238
    const yToSvg = (v: number) => 132 - ((v - minY) / (maxY - minY || 1)) * 110

    statsNode = (
      <div className="grid grid-cols-3 gap-2 text-center text-xs bg-[var(--color-bg)] p-2.5 rounded-xl">
        <div>
          <span className="text-[10px] text-[var(--color-ink-soft)] block">Matched days</span>
          <span className="font-bold text-[var(--color-ink)]">{pairs.length}</span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-ink-soft)] block">Spearman rho</span>
          <span className="font-bold text-[var(--color-accent)]">{sp.rho.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-ink-soft)] block">p-value</span>
          <span className="font-bold text-[var(--color-ink)]">{sp.pValue.toFixed(4)}</span>
        </div>
      </div>
    )

    chartNode = (
      <svg viewBox="0 0 300 155" className="w-full h-40 bg-[var(--color-bg)] rounded-xl p-1">
        <line x1="40" y1="18" x2="40" y2="134" stroke="var(--color-line)" strokeWidth="1" />
        <line x1="40" y1="134" x2="285" y2="134" stroke="var(--color-line)" strokeWidth="1" />
        <text x="6" y="28" fontSize="9" fill="var(--color-ink-soft)">{maxY.toFixed(1)}</text>
        <text x="6" y="134" fontSize="9" fill="var(--color-ink-soft)">{minY.toFixed(1)}</text>
        <text x="42" y="148" fontSize="9" fill="var(--color-ink-soft)">{minX.toFixed(1)}</text>
        <text x="278" y="148" textAnchor="end" fontSize="9" fill="var(--color-ink-soft)">{maxX.toFixed(1)}</text>
        {pairs.map((pt, idx) => (
          <circle
            key={idx}
            cx={xToSvg(pt.x)}
            cy={yToSvg(pt.y)}
            r="3.2"
            fill="var(--color-accent)"
            opacity="0.68"
          >
            <title>{`${pt.date}: X=${pt.x}, Y=${pt.y}`}</title>
          </circle>
        ))}
      </svg>
    )
  }

  return (
    <div className="sticker-card p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-[var(--color-ink)]">Custom Relationship Explorer</h3>
        <p className="text-[11px] text-[var(--color-ink-soft)]">
          Test any factor against any outcome with a 0 to 3 day lag.
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <label className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block mb-1">
            Factor X (Driver)
          </label>
          <select
            value={selectedDriver?.key || ''}
            onChange={(e) => onChangeDriver(e.target.value)}
            className="w-full p-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold"
          >
            {driverOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider block mb-1">
            Outcome Y
          </label>
          <select
            value={selectedOutcome?.key || ''}
            onChange={(e) => onChangeOutcome(e.target.value)}
            className="w-full p-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] font-semibold"
          >
            {outcomeOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider">
              Lag Offset
            </span>
            <span className="text-[11px] font-bold text-[var(--color-accent)]">
              {lag === 0 ? 'Same day (0d)' : lag === 1 ? 'Next day (+1d)' : `+${lag} days`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={lag}
            onChange={(e) => onChangeLag(Number(e.target.value))}
            className="w-full accent-[var(--color-accent)]"
          />
        </div>
      </div>

      {statsNode}
      {chartNode}
    </div>
  )
}
