import { describe, it, expect } from 'vitest'
import { searchArchive, levenshteinDistance } from '../core/search'
import { createZipArchive, readZipArchive } from '../core/zip'
import { buildFrozenChapter } from '../core/freeze'
import type {
  Chapter,
  Day,
  Answer,
  AnswerLink,
  Question,
  Part,
  Item,
  Section,
} from '../data/types'

describe('Archive Search: Fuzzy matching & filtering', () => {
  it('correctly computes Levenshtein distance', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3)
    expect(levenshteinDistance('dream', 'drame')).toBe(2)
    expect(levenshteinDistance('forest', 'forest')).toBe(0)
  })

  it('finds a misspelled word from a dream text and library item, and narrows when filtered to one question', () => {
    const questions: Question[] = [
      { id: 'q_sleep', sectionId: 's_routine', label: 'Sleep', order: 1, repeats: false, createdAt: 0, updatedAt: 0 },
      { id: 'q_fitness', sectionId: 's_activities', label: 'Fitness', order: 2, repeats: false, createdAt: 0, updatedAt: 0 },
    ]

    const parts: Part[] = [
      { id: 'p_dream_story', questionId: 'q_sleep', kind: 'text', label: 'Dream story', order: 1, level: 'extra', config: {}, createdAt: 0, updatedAt: 0 },
      { id: 'p_fitness_note', questionId: 'q_fitness', kind: 'text', label: 'Workout note', order: 1, level: 'extra', config: {}, createdAt: 0, updatedAt: 0 },
    ]

    const items: Item[] = [
      { id: 'item_yoga', libraryId: 'lib_workout', name: 'Vinyasa Yoga', createdAt: 0, updatedAt: 0 },
    ]

    const days: Day[] = [
      { date: '2026-05-10', chapterId: 'ch1', memorability: 1, mode: 'full', expandedMore: false, backfilled: false, filledAt: 0, tz: 'UTC' },
      { date: '2026-05-11', chapterId: 'ch2', memorability: 3, mode: 'full', expandedMore: false, backfilled: false, filledAt: 0, tz: 'UTC' },
    ]

    const answers: Answer[] = [
      {
        id: 'ans_dream',
        date: '2026-05-10',
        questionId: 'q_sleep',
        partId: 'p_dream_story',
        instance: 0,
        value: 'Wandered through an enchanted quiet labyrinth under the starry night sky.',
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: 'ans_fitness',
        date: '2026-05-11',
        questionId: 'q_fitness',
        partId: 'p_fitness_note',
        instance: 0,
        value: 'Did stretching after running.',
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const answerLinks: AnswerLink[] = [
      {
        id: 'link1',
        answerId: 'ans_fitness',
        date: '2026-05-11',
        libraryId: 'lib_workout',
        itemId: 'item_yoga',
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const searchData = {
      days,
      answers,
      answerLinks,
      questions,
      parts,
      libraries: [{ id: 'lib_workout', name: 'Workout types', createdAt: 0, updatedAt: 0 }],
      items,
      chapters: [
        { id: 'ch1', startDate: '2026-05-01', plannedEndDate: '2026-05-28', status: 'closed' as const, themeId: 'cutesy', characterId: 'white-cat', createdAt: 0, updatedAt: 0 },
        { id: 'ch2', startDate: '2026-05-29', plannedEndDate: '2026-06-25', status: 'open' as const, themeId: 'cutesy', characterId: 'white-cat', createdAt: 0, updatedAt: 0 },
      ],
      chapterAnswers: [],
    }

    // 1. Fuzzy match for dream word "labrynth" (misspelling of labyrinth)
    const dreamResults = searchArchive(searchData, { query: 'labrynth' })
    expect(dreamResults.length).toBeGreaterThan(0)
    expect(dreamResults[0].hits[0].sourceLabel).toContain('Sleep')

    // 2. Fuzzy match for library tag "Vinyasa"
    const tagResults = searchArchive(searchData, { query: 'vinyasa' })
    expect(tagResults.length).toBeGreaterThan(0)
    expect(tagResults[0].hits[0].sourceLabel).toContain('Tag: Vinyasa Yoga')

    // 3. Question filter narrows results
    const filteredResults = searchArchive(searchData, { query: 'labyrinth', questionId: 'q_fitness' })
    expect(filteredResults).toHaveLength(0) // Does not match in fitness question

    const matchingFilteredResults = searchArchive(searchData, { query: 'labyrinth', questionId: 'q_sleep' })
    expect(matchingFilteredResults).toHaveLength(1)
  })
})

describe('ZIP Archive: Pure TypeScript round trip', () => {
  it('creates and reads PKZIP archive with lossless equality', () => {
    const files = [
      { name: 'manifest.json', content: JSON.stringify({ kind: 'chapter', version: 1 }) },
      { name: 'days.json', content: JSON.stringify([{ date: '2026-05-01', rating: 9 }]) },
      { name: 'nested/test.txt', content: 'Universal zero-dependency ZIP encoder' },
    ]

    const zipBytes = createZipArchive(files)
    expect(zipBytes.length).toBeGreaterThan(100)

    const extracted = readZipArchive(zipBytes)
    expect(extracted).toHaveLength(3)

    const manifestFile = extracted.find((f) => f.name === 'manifest.json')
    expect(manifestFile).toBeDefined()
    expect(JSON.parse(manifestFile!.text())).toEqual({ kind: 'chapter', version: 1 })

    const nestedFile = extracted.find((f) => f.name === 'nested/test.txt')
    expect(nestedFile?.text()).toBe('Universal zero-dependency ZIP encoder')
  })
})

describe('Chapter Freeze: Stability across code updates', () => {
  it('generates render-agnostic frozen chart models with rendererVersion: 1', () => {
    const chapter: Chapter = {
      id: 'ch1',
      title: 'Foundations',
      startDate: '2026-05-01',
      plannedEndDate: '2026-05-28',
      status: 'closed',
      themeId: 'cutesy',
      characterId: 'white-cat',
      createdAt: 0,
      updatedAt: 0,
    }

    const sections: Section[] = [
      { id: 's_state', name: 'State', icon: 'smile', order: 1, scope: 'daily', createdAt: 0, updatedAt: 0 },
    ]

    const questions: Question[] = [
      { id: 'q_mood', sectionId: 's_state', label: 'Mood', order: 1, repeats: false, createdAt: 0, updatedAt: 0 },
    ]

    const parts: Part[] = [
      { id: 'p_mood_val', questionId: 'q_mood', kind: 'scale', label: 'Mood level', order: 1, level: 'core', config: { min: 0, max: 10, step: 1, display: 'slider' }, createdAt: 0, updatedAt: 0 },
    ]

    const days: Day[] = [
      { date: '2026-05-01', chapterId: 'ch1', memorability: 0, mode: 'full', expandedMore: false, backfilled: false, filledAt: 0, tz: 'UTC' },
      { date: '2026-05-02', chapterId: 'ch1', memorability: 2, mode: 'full', expandedMore: false, backfilled: false, filledAt: 0, tz: 'UTC' },
    ]

    const answers: Answer[] = [
      { id: 'a1', date: '2026-05-01', questionId: 'q_mood', partId: 'p_mood_val', instance: 0, value: 8, createdAt: 0, updatedAt: 0 },
      { id: 'a2', date: '2026-05-02', questionId: 'q_mood', partId: 'p_mood_val', instance: 0, value: 9, createdAt: 0, updatedAt: 0 },
    ]

    const frozen = buildFrozenChapter({
      chapter,
      days,
      answers,
      sections,
      questions,
      parts,
      libraries: [],
    })

    expect(frozen.dashboard).toHaveLength(2)
    expect(frozen.dashboard[0].chartId).toBe('chart_q_mood.p_mood_val.value')
    expect(frozen.dashboard[0].rendererVersion).toBe(1)
    expect(frozen.dashboard[0].type).toBe('line')
    expect(frozen.dashboard[1].chartId).toBe('chart_derived.memorability')
    expect(frozen.metadata.daysFilled).toBe(2)
    expect((frozen.stats as any)['q_mood.p_mood_val.value'].mean).toBe(8.5)
  })
})
