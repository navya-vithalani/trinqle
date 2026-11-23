/**
 * Logical day and time calculation utilities.
 *
 * Rules (PRD 5.1 & TRD 4):
 * - Default nightly window: 21:00 to 03:00 (editable).
 * - If local hour < windowEndHour, entry belongs to the PREVIOUS calendar date.
 * - Backfill: only the last 3 days (today-3 .. today-1), only within the open chapter.
 */

export interface FormWindowHours {
  startHour: number // e.g. 21
  endHour: number // e.g. 3
}

export const DEFAULT_WINDOW: FormWindowHours = {
  startHour: 21,
  endHour: 3,
}

/**
 * Returns the IANA time zone of the current environment.
 */
export function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Formats a Date object as YYYY-MM-DD.
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Parses a YYYY-MM-DD string into a Date at local midnight.
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/**
 * Adds N days to a YYYY-MM-DD date string.
 */
export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

/**
 * Calculates the logical date for a given instant and time zone.
 * If local hour < windowEndHour, the logical date is the previous calendar day.
 */
export function logicalDate(
  instant: Date | number,
  _tz?: string,
  windowEndHour: number = DEFAULT_WINDOW.endHour
): string {
  const d = typeof instant === 'number' ? new Date(instant) : new Date(instant.getTime())
  const hour = d.getHours()

  if (hour < windowEndHour) {
    // Falls into the previous calendar date's window
    d.setDate(d.getDate() - 1)
  }

  return formatDate(d)
}

/**
 * Checks whether the nightly diary form window is currently open.
 * The window is open when local time >= startHour OR local time < endHour.
 */
export function isWindowOpen(
  instant: Date | number,
  startHour: number = DEFAULT_WINDOW.startHour,
  endHour: number = DEFAULT_WINDOW.endHour
): boolean {
  const d = typeof instant === 'number' ? new Date(instant) : instant
  const hour = d.getHours()

  if (startHour > endHour) {
    // Window spans across midnight (e.g. 21:00 to 03:00)
    return hour >= startHour || hour < endHour
  } else {
    // Window within the same calendar day (e.g. 18:00 to 23:00)
    return hour >= startHour && hour < endHour
  }
}

/**
 * Determines whether a target date is eligible for backfill.
 * Allowed for today-3 .. today-1, strictly inside the open chapter.
 */
export function canBackfill(
  targetDate: string,
  todayLogicalDate: string,
  chapterStartDate: string,
  chapterPlannedEndDate?: string
): boolean {
  // Must be strictly before today
  if (targetDate >= todayLogicalDate) return false

  // Must not be earlier than chapter start
  if (targetDate < chapterStartDate) return false

  // Must not exceed planned chapter end date if provided
  if (chapterPlannedEndDate && targetDate > chapterPlannedEndDate) return false

  // Check 3-day window
  const earliestAllowed = addDays(todayLogicalDate, -3)
  return targetDate >= earliestAllowed
}

/**
 * Calculates duration in minutes for a time range, supporting midnight crossing.
 */
export function calculateMinutes(start: string, end: string, crossesMidnight: boolean): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)

  let startMinutes = sh * 60 + sm
  let endMinutes = eh * 60 + em

  if (crossesMidnight || endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  return Math.max(0, endMinutes - startMinutes)
}
