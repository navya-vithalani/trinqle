import { addDays } from './logicalDay'
import type { Chapter } from '../data/types'

export const MIN_CHAPTER_DAYS = 20
export const MAX_CHAPTER_DAYS = 45
export const DEFAULT_CHAPTER_DAYS = 28
export const MIN_END_DAYS_FROM_TODAY = 3

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
 * Gets valid min and max planned end dates for a given start date (and optional today date).
 * Enforces 20..45 day chapter length and at least today + 3 days so the T-2 lock doesn't trigger immediately.
 */
export function getPlannedEndBounds(
  startDate: string,
  todayDate?: string
): {
  minDate: string
  maxDate: string
  canExtend: boolean
} {
  const minByDuration = addDays(startDate, MIN_CHAPTER_DAYS - 1)
  const maxDate = addDays(startDate, MAX_CHAPTER_DAYS - 1)
  const minByToday = todayDate ? addDays(todayDate, MIN_END_DAYS_FROM_TODAY) : minByDuration
  const minDate = minByToday > minByDuration ? minByToday : minByDuration

  return {
    minDate,
    maxDate,
    canExtend: minDate <= maxDate,
  }
}

/**
 * Validates that plannedEndDate is within MIN_CHAPTER_DAYS..MAX_CHAPTER_DAYS from startDate
 * and (when todayDate is provided) at least 3 days after todayDate.
 */
export function isPlannedEndDateValid(
  startDate: string,
  plannedEndDate: string,
  todayDate?: string
): boolean {
  const days = calculateChapterDuration(startDate, plannedEndDate)
  if (days < MIN_CHAPTER_DAYS || days > MAX_CHAPTER_DAYS) {
    return false
  }
  if (todayDate) {
    const minByToday = addDays(todayDate, MIN_END_DAYS_FROM_TODAY)
    if (plannedEndDate < minByToday) {
      return false
    }
  }
  return true
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
