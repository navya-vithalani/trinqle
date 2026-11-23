import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { TrinqleDB } from '../data/db'
import {
  FormRepository,
  LibraryRepository,
  ChapterRepository,
} from '../data/repositories'
import type { AnswerLink } from '../data/types'

describe('Phase 4: Form Editor & Library Manager', () => {
  let testDb: TrinqleDB
  let formRepo: FormRepository
  let libRepo: LibraryRepository
  let chapterRepo: ChapterRepository

  beforeEach(async () => {
    testDb = new TrinqleDB(`test_formeditor_${Date.now()}_${Math.random()}`)
    formRepo = new FormRepository(testDb)
    libRepo = new LibraryRepository(testDb)
    chapterRepo = new ChapterRepository(testDb)
  })

  describe('Form Repository Operations', () => {
    it('creates sections with effective dating and can reorder them', async () => {
      const s1 = await formRepo.createSection({
        name: 'Morning',
        validFrom: '2026-10-01',
      })
      const s2 = await formRepo.createSection({
        name: 'Evening',
        validFrom: '2026-10-01',
      })
      const s3 = await formRepo.createSection({
        name: 'Night',
        validFrom: '2026-11-01',
      })

      const all = await formRepo.getSections()
      expect(all.length).toBe(3)

      // Reorder Evening first, then Morning, then Night
      await formRepo.reorderSections([s2.id, s1.id, s3.id])
      const reordered = await formRepo.getSections()
      expect(reordered[0].name).toBe('Evening')
      expect(reordered[1].name).toBe('Morning')
      expect(reordered[2].name).toBe('Night')

      // Date filtering: on 2026-10-15, s3 should not be active
      const activeMidOctober = await formRepo.getSections('2026-10-15')
      expect(activeMidOctober.map((s) => s.name)).toEqual(['Evening', 'Morning'])

      // On 2026-11-05, all 3 are active
      const activeNovember = await formRepo.getSections('2026-11-05')
      expect(activeNovember.length).toBe(3)
    })

    it('retires a section with validTo date', async () => {
      const s1 = await formRepo.createSection({
        name: 'Habits',
        validFrom: '2026-10-01',
      })

      await formRepo.retireSection(s1.id, '2026-10-20')

      // Active before retirement date
      const beforeRetire = await formRepo.getSections('2026-10-15')
      expect(beforeRetire.some((s) => s.id === s1.id)).toBe(true)

      // Inactive on or after retirement date
      const afterRetire = await formRepo.getSections('2026-10-25')
      expect(afterRetire.some((s) => s.id === s1.id)).toBe(false)
    })

    it('creates questions, reorders them, and moves between sections', async () => {
      const secA = await formRepo.createSection({ name: 'Section A' })
      const secB = await formRepo.createSection({ name: 'Section B' })

      const q1 = await formRepo.createQuestion({
        sectionId: secA.id,
        label: 'Question 1',
      })
      const q2 = await formRepo.createQuestion({
        sectionId: secA.id,
        label: 'Question 2',
      })

      let questionsSecA = (await formRepo.getQuestions()).filter(
        (q) => q.sectionId === secA.id
      )
      expect(questionsSecA.length).toBe(2)

      // Move Question 2 to Section B
      await formRepo.moveQuestionToSection(q2.id, secB.id)

      questionsSecA = (await formRepo.getQuestions()).filter(
        (q) => q.sectionId === secA.id
      )
      expect(questionsSecA.length).toBe(1)
      expect(questionsSecA[0].id).toBe(q1.id)

      const questionsSecB = (await formRepo.getQuestions()).filter(
        (q) => q.sectionId === secB.id
      )
      expect(questionsSecB.length).toBe(1)
      expect(questionsSecB[0].id).toBe(q2.id)
    })

    it('creates parts, toggles core/extra level, and retires parts', async () => {
      const sec = await formRepo.createSection({ name: 'Daily' })
      const q = await formRepo.createQuestion({
        sectionId: sec.id,
        label: 'Energy check',
      })

      const part = await formRepo.createPart({
        questionId: q.id,
        kind: 'scale',
        label: 'Energy level',
        level: 'core',
        config: { min: 1, max: 10, step: 1 },
      })
      expect(part.level).toBe('core')

      // 1-tap toggle to extra
      const toggled1 = await formRepo.togglePartLevel(part.id)
      expect(toggled1.level).toBe('extra')

      // 1-tap toggle back to core
      const toggled2 = await formRepo.togglePartLevel(part.id)
      expect(toggled2.level).toBe('core')

      // Retire part
      await formRepo.retirePart(part.id, '2026-10-31')
      const activeAfter = await formRepo.getParts('2026-11-05')
      expect(activeAfter.some((p) => p.id === part.id)).toBe(false)
    })

    it('returns a full active snapshot filtered by date', async () => {
      const sec = await formRepo.createSection({
        name: 'Active Sec',
        validFrom: '2026-10-01',
      })
      const q = await formRepo.createQuestion({
        sectionId: sec.id,
        label: 'Active Q',
        validFrom: '2026-10-01',
      })
      await formRepo.createPart({
        questionId: q.id,
        kind: 'text',
        label: 'Active Part',
        validFrom: '2026-10-01',
      })

      const snapshot = await formRepo.getSnapshot('2026-10-15')
      expect(snapshot.sections.length).toBe(1)
      expect(snapshot.questions.length).toBe(1)
      expect(snapshot.parts.length).toBe(1)
    })
  })

  describe('Library Repository Operations & Merging', () => {
    it('creates, renames, and retires libraries', async () => {
      const lib = await libRepo.createLibrary('Hobbies')
      expect(lib.name).toBe('Hobbies')

      await libRepo.renameLibrary(lib.id, 'Pastimes')
      const renamed = await libRepo.getLibraryById(lib.id)
      expect(renamed?.name).toBe('Pastimes')

      await libRepo.retireLibrary(lib.id)
      const activeLibs = await libRepo.getLibraries()
      expect(activeLibs.some((l) => l.id === lib.id)).toBe(false)
    })

    it('creates, renames, and retires items in a library', async () => {
      const lib = await libRepo.createLibrary('Activities')
      const item1 = await libRepo.createItem(lib.id, 'Running')
      const item2 = await libRepo.createItem(lib.id, 'Cycling')

      let items = await libRepo.getItems(lib.id)
      expect(items.length).toBe(2)

      // Rename item
      await libRepo.renameItem(item1.id, 'Jogging')
      items = await libRepo.getItems(lib.id)
      expect(items.find((i) => i.id === item1.id)?.name).toBe('Jogging')

      // Retire item
      await libRepo.retireItem(item2.id)
      items = await libRepo.getItems(lib.id)
      expect(items.length).toBe(1)
      expect(items[0].id).toBe(item1.id)
    })

    it('merges Item A into Item B and rewrites existing AnswerLink records', async () => {
      const lib = await libRepo.createLibrary('Beverages')
      const itemCoffee = await libRepo.createItem(lib.id, 'Coffee')
      const itemEspresso = await libRepo.createItem(lib.id, 'Espresso')

      // Create existing AnswerLink records referencing Espresso
      const link1: AnswerLink = {
        id: 'link_1',
        answerId: 'ans_101',
        libraryId: lib.id,
        itemId: itemEspresso.id,
        date: '2026-10-15',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const link2: AnswerLink = {
        id: 'link_2',
        answerId: 'ans_102',
        libraryId: lib.id,
        itemId: itemEspresso.id,
        date: '2026-10-15',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await testDb.answerLinks.bulkPut([link1, link2])

      // Verify links exist with Espresso ID
      const preLinks = await testDb.answerLinks
        .where('itemId')
        .equals(itemEspresso.id)
        .toArray()
      expect(preLinks.length).toBe(2)

      // Merge Espresso into Coffee
      await libRepo.mergeItems(lib.id, itemEspresso.id, itemCoffee.id)

      // 1. Espresso item should now be retired with mergedInto pointing to Coffee
      const sourceItem = await testDb.items.get(itemEspresso.id)
      expect(sourceItem?.retired).toBe(true)
      expect(sourceItem?.mergedInto).toBe(itemCoffee.id)

      // 2. Active items for the library should only include Coffee
      const activeItems = await libRepo.getItems(lib.id)
      expect(activeItems.length).toBe(1)
      expect(activeItems[0].id).toBe(itemCoffee.id)

      // 3. Existing AnswerLink records should be rewritten to point to Coffee
      const oldLinks = await testDb.answerLinks
        .where('itemId')
        .equals(itemEspresso.id)
        .toArray()
      expect(oldLinks.length).toBe(0)

      const updatedLinks = await testDb.answerLinks
        .where('itemId')
        .equals(itemCoffee.id)
        .toArray()
      expect(updatedLinks.length).toBe(2)
      expect(updatedLinks[0].id).toBe('link_1')
      expect(updatedLinks[1].id).toBe('link_2')
    })
  })

  describe('Effective Dating Scope Calculations', () => {
    it('calculates proper validFrom dates for "From next chapter" vs "From this chapter"', async () => {
      const chapter = await chapterRepo.createChapter({
        startDate: '2026-10-01',
        plannedEndDate: '2026-10-28',
        title: 'October Chapter',
      })

      // Next chapter scope: plannedEndDate + 1 day = 2026-10-29
      const nextChapterValidFrom = '2026-10-29'
      const thisChapterValidFrom = chapter.startDate // 2026-10-01

      // Question created with Next Chapter scope
      const qNext = await formRepo.createQuestion({
        sectionId: 'sec_1',
        label: 'Upcoming question',
        validFrom: nextChapterValidFrom,
      })

      // Question created with This Chapter scope
      const qThis = await formRepo.createQuestion({
        sectionId: 'sec_1',
        label: 'Current question',
        validFrom: thisChapterValidFrom,
      })

      // On 2026-10-15 (inside current chapter)
      const midChapterQuestions = await formRepo.getQuestions('2026-10-15')
      expect(midChapterQuestions.some((q) => q.id === qThis.id)).toBe(true)
      expect(midChapterQuestions.some((q) => q.id === qNext.id)).toBe(false)

      // On 2026-11-01 (next chapter)
      const nextChapterQuestions = await formRepo.getQuestions('2026-11-01')
      expect(nextChapterQuestions.some((q) => q.id === qThis.id)).toBe(true)
      expect(nextChapterQuestions.some((q) => q.id === qNext.id)).toBe(true)
    })
  })
})
