import type {
  Day,
  Answer,
  AnswerLink,
  Question,
  Part,
  Library,
  Item,
  Chapter,
  ChapterAnswer,
} from '../data/types'

export type SearchSourceKind = 'all' | 'text' | 'library' | 'day_header' | 'reflections'

export interface SearchFilterOptions {
  query: string
  sourceKind?: SearchSourceKind
  sectionId?: string
  questionId?: string
  chapterId?: string
  startDate?: string
  endDate?: string
  exactPhrase?: boolean
  sortBy?: 'newest' | 'bestMatch'
}

export interface SearchHit {
  id: string
  date?: string
  chapterId?: string
  sourceKind: 'text' | 'library' | 'day_header' | 'reflections'
  sourceLabel: string // e.g. "Dream story", "Fitness: Workout", "Day Title"
  snippet: string
  highlightedSnippet: string
  score: number // Higher = better match
  dayTitle?: string
  memorability?: number
}

export interface DaySearchResult {
  date: string
  chapterId?: string
  dayTitle?: string
  memorability?: number
  hits: SearchHit[]
  maxScore: number
}

/**
 * Computes Levenshtein distance between two strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length
  const n = s2.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

/**
 * Checks if a word fuzzy matches a target term.
 * Allows prefix match or edit distance <= 2 for words >= 4 characters.
 */
function fuzzyMatchWord(word: string, queryWord: string): boolean {
  if (word.startsWith(queryWord)) return true
  if (queryWord.length < 3) return word === queryWord

  const maxDist = queryWord.length >= 6 ? 2 : 1
  return levenshteinDistance(word, queryWord) <= maxDist
}

/**
 * Highlights matches in text using a bold span tag without emojis.
 */
function highlightText(text: string, queryWords: string[]): { highlighted: string; score: number } {
  let score = 0
  const lower = text.toLowerCase()

  // Find occurrences of query words
  let highlighted = text
  for (const qw of queryWords) {
    if (!qw) continue
    const regex = new RegExp(`(${qw})`, 'gi')
    if (regex.test(highlighted)) {
      score += 10
      highlighted = highlighted.replace(regex, '<mark class="bg-amber-200 dark:bg-amber-900/60 font-semibold px-0.5 rounded">$1</mark>')
    } else {
      // Fuzzy test against individual words
      const words = lower.split(/[\s,.;:!?]+/)
      for (const w of words) {
        if (fuzzyMatchWord(w, qw)) {
          score += 5
          const fuzzyReg = new RegExp(`(${w})`, 'gi')
          highlighted = highlighted.replace(fuzzyReg, '<mark class="bg-amber-200 dark:bg-amber-900/60 font-semibold px-0.5 rounded">$1</mark>')
          break
        }
      }
    }
  }

  return { highlighted, score }
}

export interface SearchIndexData {
  days: Day[]
  answers: Answer[]
  answerLinks: AnswerLink[]
  questions: Question[]
  parts: Part[]
  libraries: Library[]
  items: Item[]
  chapters: Chapter[]
  chapterAnswers: ChapterAnswer[]
}

/**
 * Executes a full-text fuzzy and exact search across all journal data.
 * Pure function compliant with TRD Section 11b.
 */
export function searchArchive(
  data: SearchIndexData,
  options: SearchFilterOptions
): DaySearchResult[] {
  const {
    days,
    answers,
    answerLinks,
    questions,
    parts,
    items,
    chapterAnswers,
  } = data

  const qMap = new Map<string, Question>()
  questions.forEach((q) => qMap.set(q.id, q))

  const pMap = new Map<string, Part>()
  parts.forEach((p) => pMap.set(p.id, p))

  const itemMap = new Map<string, Item>()
  items.forEach((i) => itemMap.set(i.id, i))

  const dayMap = new Map<string, Day>()
  days.forEach((d) => dayMap.set(d.date, d))

  const queryRaw = options.query.trim()
  if (!queryRaw) return []

  // Check if quoted phrase
  const isQuoted =
    options.exactPhrase ||
    (queryRaw.startsWith('"') && queryRaw.endsWith('"') && queryRaw.length >= 2)
  const cleanQuery = isQuoted
    ? queryRaw.replace(/^"|"$/g, '').toLowerCase().trim()
    : queryRaw.toLowerCase()

  const queryWords = cleanQuery.split(/\s+/).filter(Boolean)
  const hits: SearchHit[] = []

  // 1. Search Text Answers
  if (!options.sourceKind || options.sourceKind === 'all' || options.sourceKind === 'text') {
    for (const ans of answers) {
      if (typeof ans.value !== 'string') continue
      const textVal = ans.value.trim()
      if (!textVal) continue

      const part = pMap.get(ans.partId)
      const question = qMap.get(ans.questionId)

      // Apply section / question / chapter filters
      if (options.sectionId && question?.sectionId !== options.sectionId) continue
      if (options.questionId && ans.questionId !== options.questionId) continue
      if (options.startDate && ans.date < options.startDate) continue
      if (options.endDate && ans.date > options.endDate) continue

      const day = dayMap.get(ans.date)
      if (options.chapterId && day?.chapterId !== options.chapterId) continue

      const lowerText = textVal.toLowerCase()
      let matched = false
      let hitScore = 0
      let highlighted = textVal

      if (isQuoted) {
        if (lowerText.includes(cleanQuery)) {
          matched = true
          hitScore = 20
          highlighted = textVal.replace(
            new RegExp(`(${cleanQuery})`, 'gi'),
            '<mark class="bg-amber-200 dark:bg-amber-900/60 font-semibold px-0.5 rounded">$1</mark>'
          )
        }
      } else {
        const hRes = highlightText(textVal, queryWords)
        if (hRes.score > 0) {
          matched = true
          hitScore = hRes.score
          highlighted = hRes.highlighted
        }
      }

      if (matched) {
        hits.push({
          id: ans.id,
          date: ans.date,
          chapterId: day?.chapterId,
          sourceKind: 'text',
          sourceLabel: `${question?.label || 'Question'} • ${part?.label || 'Text'}`,
          snippet: textVal.length > 220 ? `${textVal.slice(0, 220)}...` : textVal,
          highlightedSnippet: highlighted,
          score: hitScore,
          dayTitle: day?.title,
          memorability: day?.memorability,
        })
      }
    }
  }

  // 2. Search Library Items via AnswerLink
  if (!options.sourceKind || options.sourceKind === 'all' || options.sourceKind === 'library') {
    for (const link of answerLinks) {
      const item = itemMap.get(link.itemId)
      if (!item) continue

      const day = dayMap.get(link.date)
      if (options.chapterId && day?.chapterId !== options.chapterId) continue
      if (options.startDate && link.date < options.startDate) continue
      if (options.endDate && link.date > options.endDate) continue

      const itemName = item.name
      const lowerName = itemName.toLowerCase()
      let matched = false
      let hitScore = 0

      if (isQuoted) {
        matched = lowerName.includes(cleanQuery)
        hitScore = 15
      } else {
        matched = queryWords.some((qw) => fuzzyMatchWord(lowerName, qw))
        hitScore = 10
      }

      if (matched) {
        hits.push({
          id: link.id,
          date: link.date,
          chapterId: day?.chapterId,
          sourceKind: 'library',
          sourceLabel: `Tag: ${itemName}`,
          snippet: itemName,
          highlightedSnippet: `<mark class="bg-amber-200 dark:bg-amber-900/60 font-semibold px-0.5 rounded">${itemName}</mark>`,
          score: hitScore,
          dayTitle: day?.title,
          memorability: day?.memorability,
        })
      }
    }
  }

  // 3. Search Day Headers (Title & One-liner)
  if (!options.sourceKind || options.sourceKind === 'all' || options.sourceKind === 'day_header') {
    for (const day of days) {
      if (options.chapterId && day.chapterId !== options.chapterId) continue
      if (options.startDate && day.date < options.startDate) continue
      if (options.endDate && day.date > options.endDate) continue

      const combinedHeader = `${day.title || ''} ${day.oneliner || ''}`.trim()
      if (!combinedHeader) continue

      const lowerHeader = combinedHeader.toLowerCase()
      let matched = false
      let hitScore = 0
      let highlighted = combinedHeader

      if (isQuoted) {
        if (lowerHeader.includes(cleanQuery)) {
          matched = true
          hitScore = 25
          highlighted = combinedHeader.replace(
            new RegExp(`(${cleanQuery})`, 'gi'),
            '<mark class="bg-amber-200 dark:bg-amber-900/60 font-semibold px-0.5 rounded">$1</mark>'
          )
        }
      } else {
        const hRes = highlightText(combinedHeader, queryWords)
        if (hRes.score > 0) {
          matched = true
          hitScore = hRes.score + 5
          highlighted = hRes.highlighted
        }
      }

      if (matched) {
        hits.push({
          id: `day_${day.date}`,
          date: day.date,
          chapterId: day.chapterId,
          sourceKind: 'day_header',
          sourceLabel: 'Day Title & Summary',
          snippet: combinedHeader,
          highlightedSnippet: highlighted,
          score: hitScore,
          dayTitle: day.title,
          memorability: day.memorability,
        })
      }
    }
  }

  // 4. Search Chapter Reflections
  if (!options.sourceKind || options.sourceKind === 'all' || options.sourceKind === 'reflections') {
    for (const ca of chapterAnswers) {
      if (typeof ca.value !== 'string') continue
      const textVal = ca.value.trim()
      if (!textVal) continue

      if (options.chapterId && ca.chapterId !== options.chapterId) continue

      const lowerVal = textVal.toLowerCase()
      let matched = false
      let hitScore = 0
      let highlighted = textVal

      if (isQuoted) {
        if (lowerVal.includes(cleanQuery)) {
          matched = true
          hitScore = 15
          highlighted = textVal.replace(
            new RegExp(`(${cleanQuery})`, 'gi'),
            '<mark class="bg-amber-200 dark:bg-amber-900/60 font-semibold px-0.5 rounded">$1</mark>'
          )
        }
      } else {
        const hRes = highlightText(textVal, queryWords)
        if (hRes.score > 0) {
          matched = true
          hitScore = hRes.score
          highlighted = hRes.highlighted
        }
      }

      if (matched) {
        hits.push({
          id: ca.id,
          chapterId: ca.chapterId,
          sourceKind: 'reflections',
          sourceLabel: 'Chapter Reflection',
          snippet: textVal.length > 220 ? `${textVal.slice(0, 220)}...` : textVal,
          highlightedSnippet: highlighted,
          score: hitScore,
        })
      }
    }
  }

  // Group hits by Day (or chapter if reflections without date)
  const groupedByDay = new Map<string, DaySearchResult>()

  for (const hit of hits) {
    const key = hit.date || `chapter_${hit.chapterId || 'unknown'}`
    const existing = groupedByDay.get(key)
    if (existing) {
      existing.hits.push(hit)
      existing.maxScore = Math.max(existing.maxScore, hit.score)
    } else {
      const day = hit.date ? dayMap.get(hit.date) : undefined
      groupedByDay.set(key, {
        date: hit.date || '',
        chapterId: hit.chapterId,
        dayTitle: day?.title || hit.dayTitle,
        memorability: day?.memorability || hit.memorability,
        hits: [hit],
        maxScore: hit.score,
      })
    }
  }

  const results = Array.from(groupedByDay.values())

  // Sort
  if (options.sortBy === 'bestMatch') {
    results.sort((a, b) => b.maxScore - a.maxScore)
  } else {
    // Newest first by default
    results.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }

  return results
}
