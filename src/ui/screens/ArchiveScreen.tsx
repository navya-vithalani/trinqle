import React, { useState, useEffect, useMemo } from 'react'
import {
  BookOpen,
  Calendar,
  Search,
  Award,
  Star,
  Download,
  Upload,
  ChevronRight,
  RefreshCw,
  FolderArchive,
  Eye,
} from 'lucide-react'
import type { Chapter, Day, Answer, AnswerLink, Section, Question, Part, Library, Item, ChapterAnswer } from '../../data/types'
import {
  ChapterRepository,
  DayRepository,
  FormRepository,
  LibraryRepository,
} from '../../data/repositories'
import {
  searchArchive,
  type SearchSourceKind,
  type DaySearchResult,
} from '../../core/search'
import { exportChapterZip, downloadOrShareFile } from '../../core/export'
import { ImportDialog } from '../dialogs/ImportDialog'

interface ArchiveScreenProps {
  onSelectArchiveChapter?: (chapter: Chapter) => void
  onNavigateToDay?: (date: string) => void
}

type ArchiveTab = 'chapters' | 'memorable' | 'search'

export const ArchiveScreen: React.FC<ArchiveScreenProps> = ({
  onSelectArchiveChapter,
  onNavigateToDay,
}) => {
  const [activeTab, setActiveTab] = useState<ArchiveTab>('chapters')
  const [isLoading, setIsLoading] = useState(true)

  // Data
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [days, setDays] = useState<Day[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [answerLinks, setAnswerLinks] = useState<AnswerLink[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [libraries, setLibraries] = useState<Library[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [chapterAnswers, setChapterAnswers] = useState<ChapterAnswer[]>([])

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SearchSourceKind>('all')
  const [exactPhrase, setExactPhrase] = useState(false)
  const [sortBy, setSortBy] = useState<'newest' | 'bestMatch'>('newest')
  const [selectedSectionId, setSelectedSectionId] = useState<string>('ALL')

  // Memorable filter
  const [memorableLevel, setMemorableLevel] = useState<number | 'ALL'>('ALL')

  // Import Dialog
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [pendingZipFile, setPendingZipFile] = useState<File | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const chapterRepo = new ChapterRepository()
      const dayRepo = new DayRepository()
      const formRepo = new FormRepository()
      const libraryRepo = new LibraryRepository()

      const [allChs, allSecs, allQs, allParts, allLibs] = await Promise.all([
        chapterRepo.getAllChapters(),
        formRepo.getSections(),
        formRepo.getQuestions(),
        formRepo.getParts(),
        libraryRepo.getLibraries(),
      ])

      setChapters(allChs)
      setSections(allSecs)
      setQuestions(allQs)
      setParts(allParts)
      setLibraries(allLibs)

      const itemPromises = allLibs.map((l) => libraryRepo.getItems(l.id))
      const nestedItems = await Promise.all(itemPromises)
      setItems(nestedItems.flat())

      const allDays = await dayRepo.getDaysInDateRange('2000-01-01', '2099-12-31')
      setDays(allDays)

      const ansPromises = allDays.map((d) => dayRepo.getAnswersForDate(d.date))
      const linkPromises = allDays.map((d) => dayRepo.getAnswerLinksForDate(d.date))

      const nestedAns = await Promise.all(ansPromises)
      const nestedLinks = await Promise.all(linkPromises)

      setAnswers(nestedAns.flat())
      setAnswerLinks(nestedLinks.flat())

      // Load chapter answers
      const caPromises = allChs.map((c) => chapterRepo.getChapterAnswers(c.id))
      const nestedCA = await Promise.all(caPromises)
      setChapterAnswers(nestedCA.flat())
    } catch (err) {
      console.error('Failed to load archive data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Closed chapters only
  const closedChapters = useMemo(() => {
    return chapters
      .filter((c) => c.status === 'closed')
      .sort((a, b) => (b.endDate || b.plannedEndDate || '').localeCompare(a.endDate || a.plannedEndDate || ''))
  }, [chapters])

  // Memorable days across all chapters
  const memorableDays = useMemo(() => {
    return days
      .filter((d) => !d.deletedAt && d.memorability > 0)
      .filter((d) => (memorableLevel === 'ALL' ? true : d.memorability === memorableLevel))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [days, memorableLevel])

  // Search Results
  const searchResults: DaySearchResult[] = useMemo(() => {
    if (!searchQuery.trim()) return []

    return searchArchive(
      {
        days,
        answers,
        answerLinks,
        questions,
        parts,
        libraries,
        items,
        chapters,
        chapterAnswers,
      },
      {
        query: searchQuery,
        sourceKind: sourceFilter,
        exactPhrase,
        sortBy,
        sectionId: selectedSectionId !== 'ALL' ? selectedSectionId : undefined,
      }
    )
  }, [
    searchQuery,
    sourceFilter,
    exactPhrase,
    sortBy,
    selectedSectionId,
    days,
    answers,
    answerLinks,
    questions,
    parts,
    libraries,
    items,
    chapters,
    chapterAnswers,
  ])

  const handleExportZip = async (chapter: Chapter) => {
    try {
      const { filename, blob } = await exportChapterZip(chapter.id)
      await downloadOrShareFile(filename, blob)
      showToast('Chapter zip exported successfully')
    } catch {
      showToast('Failed to export chapter zip')
    }
  }

  const handleZipFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingZipFile(file)
    setIsImportOpen(true)
  }

  return (
    <div className="space-y-4 pb-20">
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-[var(--color-ink)] text-white text-xs font-semibold py-1.5 px-4 rounded-full shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Top 3-Way Segmented Control */}
      <div className="flex p-1 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-line)] shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('chapters')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'chapters'
              ? 'bg-[var(--color-accent)] text-white shadow-xs'
              : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          <FolderArchive size={14} />
          <span>Chapters</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('memorable')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'memorable'
              ? 'bg-[var(--color-accent)] text-white shadow-xs'
              : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          <Award size={14} />
          <span>Memorable</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'search'
              ? 'bg-[var(--color-accent)] text-white shadow-xs'
              : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          <Search size={14} />
          <span>Search</span>
        </button>
      </div>

      {isLoading ? (
        <div className="sticker-card p-12 text-center space-y-3">
          <RefreshCw size={24} className="mx-auto text-[var(--color-accent)] animate-spin" />
          <p className="text-xs text-[var(--color-ink-soft)]">Loading archive vault...</p>
        </div>
      ) : activeTab === 'chapters' ? (
        /* SEGMENT 1: CLOSED CHAPTERS */
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[var(--color-ink-soft)]">
              {closedChapters.length} closed {closedChapters.length === 1 ? 'chapter' : 'chapters'}
            </span>
            <label className="flex items-center gap-1 text-xs font-bold text-[var(--color-accent)] hover:underline cursor-pointer">
              <Upload size={13} />
              <span>Import Chapter ZIP</span>
              <input
                type="file"
                accept=".zip"
                onChange={handleZipFileDrop}
                className="hidden"
              />
            </label>
          </div>

          {closedChapters.length === 0 ? (
            <div className="sticker-card p-8 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-accent)]">
                <BookOpen size={24} />
              </div>
              <h3 className="text-base font-bold text-[var(--color-ink)]">No Closed Chapters Yet</h3>
              <p className="text-xs text-[var(--color-ink-soft)] max-w-xs mx-auto">
                When you complete your first chapter ceremony, the frozen chapter, memories, and
                photos will be archived here.
              </p>
            </div>
          ) : (
            closedChapters.map((ch) => (
              <div
                key={ch.id}
                className="sticker-card p-4 space-y-3 hover:border-[var(--color-accent)] transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                      Closed Chapter
                    </span>
                    <h3 className="text-base font-extrabold text-[var(--color-ink)]">
                      {ch.title || 'Untitled Chapter'}
                    </h3>
                    <span className="text-xs text-[var(--color-ink-soft)] flex items-center gap-1">
                      <Calendar size={12} />
                      {ch.startDate} to {ch.endDate || ch.plannedEndDate}
                    </span>
                  </div>
                  {ch.photos && ch.photos.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)]">
                      {ch.photos.length} photos
                    </span>
                  )}
                </div>

                {ch.summary && (
                  <p className="text-xs text-[var(--color-ink)] line-clamp-2 bg-[var(--color-bg)] p-2.5 rounded-xl border border-[var(--color-line)]/50">
                    {ch.summary}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-line)]/50">
                  <button
                    type="button"
                    onClick={() => onSelectArchiveChapter?.(ch)}
                    className="flex-1 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-95 active:scale-98 transition-all"
                  >
                    <Eye size={14} />
                    <span>View in Archive Mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExportZip(ch)}
                    title="Export Chapter ZIP"
                    className="p-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-accent)] transition-colors"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'memorable' ? (
        /* SEGMENT 2: MEMORABLE DAYS */
        <div className="space-y-3">
          {/* Level Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <button
              type="button"
              onClick={() => setMemorableLevel('ALL')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                memorableLevel === 'ALL'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
              }`}
            >
              All Levels
            </button>
            <button
              type="button"
              onClick={() => setMemorableLevel(1)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                memorableLevel === 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
              }`}
            >
              Notable (1)
            </button>
            <button
              type="button"
              onClick={() => setMemorableLevel(2)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                memorableLevel === 2
                  ? 'bg-purple-600 text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
              }`}
            >
              Outstanding (2)
            </button>
            <button
              type="button"
              onClick={() => setMemorableLevel(3)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 ${
                memorableLevel === 3
                  ? 'bg-amber-500 text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
              }`}
            >
              <Star size={11} fill="currentColor" /> Star Days (3)
            </button>
          </div>

          {memorableDays.length === 0 ? (
            <div className="sticker-card p-8 text-center text-xs text-[var(--color-ink-soft)]">
              No memorable days recorded for this level.
            </div>
          ) : (
            memorableDays.map((d) => (
              <div
                key={d.date}
                onClick={() => onNavigateToDay?.(d.date)}
                className="sticker-card p-3.5 space-y-1.5 cursor-pointer hover:border-[var(--color-accent)] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-[var(--color-accent)] flex items-center gap-1">
                      <Calendar size={12} />
                      {d.date}
                    </span>
                    {d.memorability === 3 && (
                      <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[10px] font-bold border border-amber-500/30">
                        <Star size={10} fill="currentColor" /> Star Day
                      </span>
                    )}
                    {d.memorability === 2 && (
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 text-[10px] font-bold">
                        Outstanding
                      </span>
                    )}
                    {d.memorability === 1 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-[10px] font-bold">
                        Notable
                      </span>
                    )}
                  </div>
                  {d.overallRating !== undefined && (
                    <span className="text-xs font-bold text-[var(--color-ink)]">
                      {d.overallRating}/10
                    </span>
                  )}
                </div>

                {d.title && (
                  <h4 className="text-xs font-bold text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                    {d.title}
                  </h4>
                )}

                {d.oneliner && (
                  <p className="text-[11px] text-[var(--color-ink-soft)] line-clamp-2">
                    {d.oneliner}
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-[var(--color-ink-soft)] pt-1">
                  <span>Mode: {d.mode}</span>
                  <span className="flex items-center gap-0.5 text-[var(--color-accent)] font-semibold">
                    <span>Inspect</span>
                    <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* SEGMENT 3: FULL ARCHIVE SEARCH */
        <div className="space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Fuzzy search text, dream stories, tags..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)] placeholder-[var(--color-ink-soft)] focus:outline-hidden focus:border-[var(--color-accent)]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <button
              type="button"
              onClick={() => setSourceFilter('all')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                sourceFilter === 'all'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
              }`}
            >
              All Sources
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('text')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                sourceFilter === 'text'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
              }`}
            >
              Text & Dreams
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('library')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                sourceFilter === 'library'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
              }`}
            >
              Tags
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('day_header')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                sourceFilter === 'day_header'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
              }`}
            >
              Day Titles
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter('reflections')}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                sourceFilter === 'reflections'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink-soft)]'
              }`}
            >
              Reflections
            </button>
          </div>

          {/* Options: Section filter, Exact Phrase & Sort */}
          <div className="flex items-center justify-between text-xs px-1 text-[var(--color-ink-soft)] gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exactPhrase}
                  onChange={(e) => setExactPhrase(e.target.checked)}
                  className="rounded text-[var(--color-accent)]"
                />
                <span className="text-[11px] font-medium">Exact phrase</span>
              </label>

              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                aria-label="Filter by section"
                className="text-[10px] font-semibold py-0.5 px-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] text-[var(--color-ink)]"
              >
                <option value="ALL">All Sections</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold">Sort:</span>
              <button
                type="button"
                onClick={() => setSortBy(sortBy === 'newest' ? 'bestMatch' : 'newest')}
                className="text-[11px] font-bold text-[var(--color-accent)] hover:underline"
              >
                {sortBy === 'newest' ? 'Newest first' : 'Best match'}
              </button>
            </div>
          </div>

          {/* Search Hits Stream */}
          {!searchQuery.trim() ? (
            <div className="sticker-card p-8 text-center text-xs text-[var(--color-ink-soft)]">
              Enter a keyword, phrase, or topic to search across all diary entries and tags.
            </div>
          ) : searchResults.length === 0 ? (
            <div className="sticker-card p-6 text-center text-xs text-[var(--color-ink-soft)]">
              No matching records found for "{searchQuery}".
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] font-bold text-[var(--color-ink-soft)] px-1">
                Found matches across {searchResults.length} {searchResults.length === 1 ? 'day' : 'days'}
              </div>

              {searchResults.map((dayRes) => (
                <div
                  key={dayRes.date || dayRes.chapterId}
                  onClick={() => {
                    if (dayRes.date) onNavigateToDay?.(dayRes.date)
                  }}
                  className="sticker-card p-4 space-y-2 cursor-pointer hover:border-[var(--color-accent)] transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--color-accent)] flex items-center gap-1">
                      <Calendar size={12} />
                      {dayRes.date || 'Chapter Record'}
                    </span>
                    {dayRes.dayTitle && (
                      <span className="text-xs font-semibold text-[var(--color-ink)] truncate max-w-[200px]">
                        {dayRes.dayTitle}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    {dayRes.hits.map((hit) => (
                      <div
                        key={hit.id}
                        className="p-2.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-line)]/50 space-y-1 text-xs"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-soft)] block">
                          {hit.sourceLabel}
                        </span>
                        <div
                          className="leading-relaxed text-[var(--color-ink)]"
                          dangerouslySetInnerHTML={{ __html: hit.highlightedSnippet }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end pt-1">
                    <span className="text-[10px] font-semibold text-[var(--color-accent)] flex items-center gap-0.5 group-hover:underline">
                      <span>Open day entry</span>
                      <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isImportOpen && (
        <ImportDialog
          isOpen={true}
          initialFile={pendingZipFile}
          onClose={() => {
            setIsImportOpen(false)
            setPendingZipFile(null)
          }}
          onSuccess={() => {
            setIsImportOpen(false)
            setPendingZipFile(null)
            showToast('Chapter archive imported!')
            loadData()
          }}
        />
      )}
    </div>
  )
}
