import React, { useState, useEffect, useMemo } from 'react'
import {
  LayoutDashboard,
  Search,
  Filter,
  Calendar,
  Layers,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  Clock,
  Tag,
  RefreshCw,
} from 'lucide-react'
import {
  ChapterRepository,
  DayRepository,
  FormRepository,
  LibraryRepository,
} from '../../data/repositories'
import type {
  Day,
  Answer,
  AnswerLink,
  Section,
  Question,
  Part,
  Library,
  Item,
  Chapter,
} from '../../data/types'
import {
  buildDailyMetricsTable,
  calculateStreak,
  calculateScaleNumberStats,
  calculateTimeRangeStats,
  calculateLibraryStats,
  calculateMemorabilityStats,
  extractJournalEntries,
} from '../../core/metrics'
import type {
  DateScope,
  PartKindFilter,
  MetricDefinition,
  DayMetricPoint,
  LibraryItemUsage,
} from '../../core/metrics/types'
import { YesNoMetricCard } from '../dashboard/YesNoMetricCard'
import { ScaleMetricCard } from '../dashboard/ScaleMetricCard'
import { TimeRangeMetricCard } from '../dashboard/TimeRangeMetricCard'
import { TextJournalCard } from '../dashboard/TextJournalCard'
import { LibraryMetricCard } from '../dashboard/LibraryMetricCard'
import { MemorabilityCard } from '../dashboard/MemorabilityCard'
import { LibrariesListView } from '../dashboard/LibrariesListView'
import { MetricDetailModal } from '../dashboard/MetricDetailModal'
import { ItemHistoryModal } from '../dashboard/ItemHistoryModal'
import { addDays, logicalDate, DEFAULT_WINDOW } from '../../core/logicalDay'

interface DashboardScreenProps {
  windowEndHour?: number
  onNavigateToProfileBrowse?: (date: string) => void
}

type DashboardTab = 'questions' | 'libraries'

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  windowEndHour = DEFAULT_WINDOW.endHour,
  onNavigateToProfileBrowse,
}) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('questions')
  const [dateScope, setDateScope] = useState<DateScope>('chapter')
  const [partKindFilter, setPartKindFilter] = useState<PartKindFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('ALL')

  const [isLoading, setIsLoading] = useState(true)
  const [openChapter, setOpenChapter] = useState<Chapter | null>(null)
  const [days, setDays] = useState<Day[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [answerLinks, setAnswerLinks] = useState<AnswerLink[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [libraries, setLibraries] = useState<Library[]>([])
  const [items, setItems] = useState<Item[]>([])

  // Modal inspection states
  const [inspectMetric, setInspectMetric] = useState<{
    metric: MetricDefinition
    points: DayMetricPoint[]
  } | null>(null)

  const [inspectItem, setInspectItem] = useState<{
    itemUsage: LibraryItemUsage
    libraryName: string
  } | null>(null)

  // Load all repository data
  const loadData = async () => {
    setIsLoading(true)
    try {
      const chapterRepo = new ChapterRepository()
      const dayRepo = new DayRepository()
      const formRepo = new FormRepository()
      const libraryRepo = new LibraryRepository()

      const [, currentOpenCh, allSecs, allQs, allParts, allLibs] = await Promise.all([
        chapterRepo.getAllChapters(),
        chapterRepo.getOpenChapter(),
        formRepo.getSections(),
        formRepo.getQuestions(),
        formRepo.getParts(),
        libraryRepo.getLibraries(),
      ])

      setOpenChapter(currentOpenCh || null)
      setSections(allSecs)
      setQuestions(allQs)
      setParts(allParts)
      setLibraries(allLibs)

      // Fetch all items across libraries
      const itemPromises = allLibs.map((l) => libraryRepo.getItems(l.id))
      const nestedItems = await Promise.all(itemPromises)
      const flatItems = nestedItems.flat()
      setItems(flatItems)

      // Fetch all days and answers
      const allDays = await dayRepo.getDaysInDateRange('2000-01-01', '2099-12-31')
      setDays(allDays)

      // Fetch all answers and links across those days
      const ansPromises = allDays.map((d) => dayRepo.getAnswersForDate(d.date))
      const linkPromises = allDays.map((d) => dayRepo.getAnswerLinksForDate(d.date))

      const nestedAns = await Promise.all(ansPromises)
      const nestedLinks = await Promise.all(linkPromises)

      setAnswers(nestedAns.flat())
      setAnswerLinks(nestedLinks.flat())
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filter Days & Answers according to selected DateScope
  const { filteredDays, filteredAnswers, filteredLinks } = useMemo(() => {
    if (days.length === 0) {
      return { filteredDays: [], filteredAnswers: [], filteredLinks: [] }
    }

    const todayStr = logicalDate(new Date(), undefined, windowEndHour)
    let minDate = '2000-01-01'
    let maxDate = '2099-12-31'

    if (dateScope === 'chapter') {
      if (openChapter) {
        minDate = openChapter.startDate
        maxDate = openChapter.endDate || openChapter.plannedEndDate || todayStr
      } else {
        // Fallback to latest 28 days
        minDate = addDays(todayStr, -28)
      }
    } else if (dateScope === '7days') {
      minDate = addDays(todayStr, -7)
    } else if (dateScope === '30days') {
      minDate = addDays(todayStr, -30)
    }

    const filteredD = days.filter((d) => d.date >= minDate && d.date <= maxDate)
    const allowedDates = new Set(filteredD.map((d) => d.date))

    const filteredA = answers.filter((a) => allowedDates.has(a.date))
    const filteredL = answerLinks.filter((l) => allowedDates.has(l.date))

    return {
      filteredDays: filteredD,
      filteredAnswers: filteredA,
      filteredLinks: filteredL,
    }
  }, [days, answers, answerLinks, dateScope, openChapter])

  // Build Daily Table for the filtered dataset
  const dailyTable = useMemo(() => {
    return buildDailyMetricsTable(filteredDays, filteredAnswers, questions, parts)
  }, [filteredDays, filteredAnswers, questions, parts])

  // Extract Journal text entries (filtered by section and search query)
  const journalEntries = useMemo(() => {
    const raw = extractJournalEntries(filteredDays, filteredAnswers, questions, parts)
    const qMap = new Map(questions.map((q) => [q.id, q]))
    const qClean = searchQuery.toLowerCase().trim()

    return raw.filter((entry) => {
      if (selectedSectionId !== 'ALL') {
        const q = qMap.get(entry.questionId)
        if (q?.sectionId !== selectedSectionId) return false
      }
      if (qClean) {
        const matchText = entry.text.toLowerCase().includes(qClean)
        const matchTitle = (entry.dayTitle || '').toLowerCase().includes(qClean)
        const matchQ = entry.questionLabel.toLowerCase().includes(qClean)
        const matchP = entry.partLabel.toLowerCase().includes(qClean)
        if (!matchText && !matchTitle && !matchQ && !matchP) return false
      }
      return true
    })
  }, [filteredDays, filteredAnswers, questions, parts, selectedSectionId, searchQuery])

  // Memorability & Rating summary
  const memorabilityStats = useMemo(() => {
    return calculateMemorabilityStats(filteredDays)
  }, [filteredDays])

  // Filtered metrics definitions based on partKindFilter, selectedSectionId, and search query
  const displayedMetrics = useMemo(() => {
    const qClean = searchQuery.toLowerCase().trim()

    return dailyTable.metrics.filter((m) => {
      // 1. Kind filter
      if (partKindFilter === 'yesno' && m.partKind !== 'yesno') return false
      if (
        partKindFilter === 'scale_number' &&
        m.partKind !== 'scale' &&
        m.partKind !== 'number'
      )
        return false
      if (partKindFilter === 'timerange' && m.partKind !== 'timerange') return false
      if (partKindFilter === 'text' && m.partKind !== 'text') return false
      if (partKindFilter === 'library' && m.partKind !== 'library') return false

      // 2. Section filter
      if (selectedSectionId !== 'ALL' && m.sectionId !== selectedSectionId) return false

      // 3. Search query
      if (qClean) {
        const matchesLabel = m.label.toLowerCase().includes(qClean)
        const matchesQ = m.questionLabel.toLowerCase().includes(qClean)
        if (!matchesLabel && !matchesQ) return false
      }

      return true
    })
  }, [dailyTable.metrics, partKindFilter, selectedSectionId, searchQuery])

  // Quick lookup of distinct sections using real section labels
  const sectionsList = useMemo(() => {
    const secMap = new Map(sections.map((s) => [s.id, s.name]))
    const usedIds = new Set<string>()
    for (const q of questions) {
      if (q.sectionId) usedIds.add(q.sectionId)
    }
    return Array.from(usedIds).map((id) => ({
      id,
      name: secMap.get(id) || id.replace('s_', '').replace(/_/g, ' '),
    }))
  }, [sections, questions])

  return (
    <div className="space-y-4 pb-20">
      {/* Top Segmented Toggle: Questions | Libraries */}
      <div className="flex p-1 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'questions'
              ? 'bg-[var(--color-accent)] text-white shadow-xs'
              : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          <Layers size={14} />
          <span>Questions</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('libraries')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'libraries'
              ? 'bg-[var(--color-accent)] text-white shadow-xs'
              : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          <Tag size={14} />
          <span>Libraries</span>
        </button>
      </div>

      {/* Date Scope & Search Bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'questions' ? 'Search questions or journal...' : 'Search library tags...'
              }
              className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] placeholder-[var(--color-ink-soft)] focus:outline-hidden focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* Date Scope Dropdown */}
          <div className="relative">
            <select
              value={dateScope}
              onChange={(e) => setDateScope(e.target.value as DateScope)}
              aria-label="Date Scope"
              className="text-xs font-semibold py-2 px-3 pr-7 rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] focus:outline-hidden focus:border-[var(--color-accent)] appearance-none cursor-pointer"
            >
              <option value="chapter">Open Chapter</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
            <Calendar
              size={12}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)] pointer-events-none"
            />
          </div>
        </div>

        {/* Questions Tab Filters */}
        {activeTab === 'questions' && (
          <div className="space-y-2">
            {/* Part Kind Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setPartKindFilter('all')}
                className={`px-3 py-1 text-[11px] font-bold rounded-full whitespace-nowrap transition-all ${
                  partKindFilter === 'all'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                }`}
              >
                All Metrics
              </button>
              <button
                type="button"
                onClick={() => setPartKindFilter('yesno')}
                className={`px-3 py-1 text-[11px] font-bold rounded-full whitespace-nowrap transition-all flex items-center gap-1 ${
                  partKindFilter === 'yesno'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                }`}
              >
                <CheckCircle2 size={12} /> Yes / No
              </button>
              <button
                type="button"
                onClick={() => setPartKindFilter('scale_number')}
                className={`px-3 py-1 text-[11px] font-bold rounded-full whitespace-nowrap transition-all flex items-center gap-1 ${
                  partKindFilter === 'scale_number'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                }`}
              >
                <TrendingUp size={12} /> Scales & Numbers
              </button>
              <button
                type="button"
                onClick={() => setPartKindFilter('timerange')}
                className={`px-3 py-1 text-[11px] font-bold rounded-full whitespace-nowrap transition-all flex items-center gap-1 ${
                  partKindFilter === 'timerange'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                }`}
              >
                <Clock size={12} /> Time Ranges
              </button>
              <button
                type="button"
                onClick={() => setPartKindFilter('text')}
                className={`px-3 py-1 text-[11px] font-bold rounded-full whitespace-nowrap transition-all flex items-center gap-1 ${
                  partKindFilter === 'text'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                }`}
              >
                <BookOpen size={12} /> Journal (Text)
              </button>
              <button
                type="button"
                onClick={() => setPartKindFilter('library')}
                className={`px-3 py-1 text-[11px] font-bold rounded-full whitespace-nowrap transition-all flex items-center gap-1 ${
                  partKindFilter === 'library'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
                }`}
              >
                <Tag size={12} /> Tags
              </button>
            </div>

            {/* Section Filter Dropdown */}
            {sectionsList.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[10px] font-bold text-[var(--color-ink-soft)] uppercase tracking-wider flex items-center gap-1">
                  <Filter size={11} /> Section:
                </span>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  aria-label="Filter by Section"
                  className="text-xs font-semibold py-1 px-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] focus:outline-hidden"
                >
                  <option value="ALL">All Sections</option>
                  {sectionsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="sticker-card p-12 text-center space-y-3">
          <RefreshCw size={24} className="mx-auto text-[var(--color-accent)] animate-spin" />
          <p className="text-xs text-[var(--color-ink-soft)]">Computing metrics & trends...</p>
        </div>
      ) : activeTab === 'libraries' ? (
        /* Libraries View */
        <LibrariesListView
          libraries={libraries}
          items={items}
          answerLinks={filteredLinks}
          answers={filteredAnswers}
          days={filteredDays}
          questions={questions}
          parts={parts}
          searchQuery={searchQuery}
          onNavigateToDay={onNavigateToProfileBrowse}
        />
      ) : filteredDays.length === 0 ? (
        /* Empty State */
        <div className="sticker-card p-8 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-accent)]">
            <LayoutDashboard size={24} />
          </div>
          <h2 className="text-base font-bold text-[var(--color-ink)]">No Data In This Scope</h2>
          <p className="text-xs text-[var(--color-ink-soft)] max-w-xs mx-auto">
            No entries were found for the selected time scope. Fill tonight's form or choose "All
            Time" or generate demo data in Profile.
          </p>
        </div>
      ) : (
        /* Questions View */
        <div className="space-y-4">
          {/* Highlights & Memorability Card */}
          {(partKindFilter === 'all' || partKindFilter === 'scale_number') &&
            memorabilityStats.totalRatedDays > 0 && (
              <MemorabilityCard
                stats={memorabilityStats}
                onNavigateToDay={onNavigateToProfileBrowse}
              />
            )}

          {/* Journal View (if text filter selected) */}
          {partKindFilter === 'text' ? (
            <div className="space-y-3">
              <div className="text-xs font-bold text-[var(--color-ink-soft)] flex items-center justify-between px-1">
                <span className="flex items-center gap-1">
                  <BookOpen size={14} className="text-[var(--color-accent)]" /> Journal Stream
                </span>
                <span>{journalEntries.length} entries</span>
              </div>
              {journalEntries.length === 0 ? (
                <div className="sticker-card p-6 text-center text-xs text-[var(--color-ink-soft)]">
                  No text journal entries recorded in this time scope.
                </div>
              ) : (
                journalEntries.map((entry) => (
                  <TextJournalCard
                    key={entry.id}
                    entry={entry}
                    onNavigateToDay={onNavigateToProfileBrowse}
                  />
                ))
              )}
            </div>
          ) : (
            /* Generic Question / Part Metrics Cards */
            <div className="space-y-4">
              {displayedMetrics.length === 0 ? (
                <div className="sticker-card p-6 text-center text-xs text-[var(--color-ink-soft)]">
                  No metrics match your filter criteria.
                </div>
              ) : (
                displayedMetrics.map((metric) => {
                  const points = dailyTable.byMetricKey[metric.key] || []

                  if (metric.partKind === 'yesno') {
                    const streakEntries = points.map((p) => ({
                      date: p.date,
                      done: p.value === 1,
                      isSkipped: p.isMissing,
                    }))
                    const stats = calculateStreak(streakEntries)
                    return (
                      <YesNoMetricCard
                        key={metric.key}
                        metric={metric}
                        stats={stats}
                        onSelect={() => setInspectMetric({ metric, points })}
                      />
                    )
                  }

                  if (metric.partKind === 'scale' || metric.partKind === 'number') {
                    const stats = calculateScaleNumberStats(points)
                    return (
                      <ScaleMetricCard
                        key={metric.key}
                        metric={metric}
                        stats={stats}
                        onSelect={() => setInspectMetric({ metric, points })}
                      />
                    )
                  }

                  if (metric.partKind === 'timerange') {
                    // Group answers for this question and part
                    const answersMap = new Map<string, Answer[]>()
                    for (const a of filteredAnswers) {
                      if (a.questionId === metric.questionId && a.partId === metric.partId) {
                        const list = answersMap.get(a.date) || []
                        list.push(a)
                        answersMap.set(a.date, list)
                      }
                    }
                    const stats = calculateTimeRangeStats(answersMap)
                    return (
                      <TimeRangeMetricCard
                        key={metric.key}
                        metric={metric}
                        stats={stats}
                        onSelect={() => setInspectMetric({ metric, points })}
                      />
                    )
                  }

                  if (metric.partKind === 'library') {
                    // Find links associated with this question & part
                    const links = filteredLinks.filter((l) => {
                      const ans = filteredAnswers.find((a) => a.id === l.answerId)
                      return (
                        ans &&
                        ans.questionId === metric.questionId &&
                        ans.partId === metric.partId
                      )
                    })
                    const stats = calculateLibraryStats(links, items)
                    return (
                      <LibraryMetricCard
                        key={metric.key}
                        metric={metric}
                        stats={stats}
                        onSelectItem={(it) =>
                          setInspectItem({
                            itemUsage: it,
                            libraryName: metric.label,
                          })
                        }
                        onSelect={() => setInspectMetric({ metric, points })}
                      />
                    )
                  }

                  if (metric.partKind === 'text' && metric.metric === 'written') {
                    const streakEntries = points.map((p) => ({
                      date: p.date,
                      done: p.value === 1,
                      isSkipped: p.isMissing,
                    }))
                    const stats = calculateStreak(streakEntries)
                    return (
                      <YesNoMetricCard
                        key={metric.key}
                        metric={metric}
                        stats={stats}
                        onSelect={() => setInspectMetric({ metric, points })}
                      />
                    )
                  }

                  return null
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Metric Detail Modal */}
      {inspectMetric && (
        <MetricDetailModal
          isOpen={true}
          metric={inspectMetric.metric}
          points={inspectMetric.points}
          onClose={() => setInspectMetric(null)}
          onNavigateToDay={onNavigateToProfileBrowse}
        />
      )}

      {/* Item History Modal */}
      {inspectItem && (
        <ItemHistoryModal
          isOpen={true}
          itemName={inspectItem.itemUsage.name}
          libraryName={inspectItem.libraryName}
          totalUses={inspectItem.itemUsage.count}
          firstUsed={inspectItem.itemUsage.firstUsed}
          lastUsed={inspectItem.itemUsage.lastUsed}
          days={inspectItem.itemUsage.dates.map((date) => ({
            date,
            questionLabel: inspectItem.libraryName,
            partLabel: 'Activity',
            mode: 'full',
          }))}
          onClose={() => setInspectItem(null)}
          onNavigateToDay={onNavigateToProfileBrowse}
        />
      )}
    </div>
  )
}
