import { addDays } from './logicalDay'
import type { Chapter } from '../data/types'

export const MIN_CHAPTER_DAYS = 20
export const MAX_CHAPTER_DAYS = 45
export const DEFAULT_CHAPTER_DAYS = 28

/**
 * Calculates chapter day count between startDate and plannedEndDate (inclusive).
 */
export function calculateChapterDuration(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const startMs = Date.UTC(sy, sm - 1, sd)
  const endMs = Date.UTC(ey, em - 1, ed)
  return Math.round((endMs - startMs) / 86400000) + 1
}

/**
 * Validates that plannedEndDate is within 20 to 45 days from startDate.
 */
export function isPlannedEndDateValid(startDate: string, plannedEndDate: string): boolean {
  const days = calculateChapterDuration(startDate, plannedEndDate)
  return days >= MIN_CHAPTER_DAYS && days <= MAX_CHAPTER_DAYS
}

/**
 * Gets valid min and max planned end dates for a given start date.
 */
export function getPlannedEndBounds(startDate: string): {
  minDate: string
  maxDate: string
} {
  return {
    minDate: addDays(startDate, MIN_CHAPTER_DAYS - 1),
    maxDate: addDays(startDate, MAX_CHAPTER_DAYS - 1),
  }
}

/**
 * Determines whether the chapter is hard-locked (past plannedEndDate).
 */
export function isChapterHardLocked(chapter: Chapter, currentLogicalDate: string): boolean {
  if (chapter.status === 'closed') return false
  return currentLogicalDate > chapter.plannedEndDate
}

/**
 * Determines whether the pre-close popup should be shown (T-2 days until plannedEndDate).
 */
export function isPreCloseDue(chapter: Chapter, currentLogicalDate: string): boolean {
  if (chapter.status === 'closed') return false
  const tMinus2 = addDays(chapter.plannedEndDate, -2)
  return currentLogicalDate >= tMinus2 && currentLogicalDate <= chapter.plannedEndDate
}

/**
 * Computes chapter progression info:
 * currentDayNumber (1..totalDays), totalDays, daysRemaining
 */
export function getChapterProgress(
  chapter: Chapter,
  currentLogicalDate: string
): {
  currentDayNumber: number
  totalDays: number
  daysRemaining: number
} {
  const totalDays = calculateChapterDuration(chapter.startDate, chapter.plannedEndDate)
  const [sy, sm, sd] = chapter.startDate.split('-').map(Number)
  const [cy, cm, cd] = currentLogicalDate.split('-').map(Number)
  const startMs = Date.UTC(sy, sm - 1, sd)
  const curMs = Date.UTC(cy, cm - 1, cd)
  const currentDayNumber = Math.max(1, Math.round((curMs - startMs) / 86400000) + 1)
  const daysRemaining = Math.max(0, totalDays - currentDayNumber)

  return {
    currentDayNumber,
    totalDays,
    daysRemaining,
  }
}
