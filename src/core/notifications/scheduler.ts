import type {
  StoredSubscription,
  GenericNotificationPayload,
} from './types'

export type DueNotificationType = 'daily' | 'monday_insights' | 'chapter_ending'

export interface DueNotificationResult {
  due: boolean
  type?: DueNotificationType
  payload?: GenericNotificationPayload
  dateStr?: string
}

/**
 * Extracts local date and time parts in a specific IANA timezone.
 */
export function getLocalDateTimeInZone(date: Date, timeZone: string): {
  dateStr: string // YYYY-MM-DD
  weekday: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number // 0..23
  minute: number // 0..59
} {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = dtf.formatToParts(date)
  const partMap: Record<string, string> = {}
  for (const p of parts) {
    partMap[p.type] = p.value
  }

  const dateStr = `${partMap.year}-${partMap.month}-${partMap.day}`
  const hour = parseInt(partMap.hour, 10) % 24
  const minute = parseInt(partMap.minute, 10)

  const weekdayStr = partMap.weekday
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  const weekday = weekdays[weekdayStr] ?? 0

  return { dateStr, weekday, hour, minute }
}

function parseTimeToMinutes(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr, 10) || 0
  const m = parseInt(mStr, 10) || 0
  return h * 60 + m
}

/**
 * Computes whether a planned chapter end date (YYYY-MM-DD) is within 0..2 days of localDateStr.
 */
function isPlannedEndSoon(localDateStr: string, plannedEndDate?: string): boolean {
  if (!plannedEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(plannedEndDate)) {
    return false
  }
  const [ly, lm, ld] = localDateStr.split('-').map(Number)
  const [py, pm, pd] = plannedEndDate.split('-').map(Number)
  const localMs = Date.UTC(ly, lm - 1, ld)
  const plannedMs = Date.UTC(py, pm - 1, pd)
  const diffDays = Math.round((plannedMs - localMs) / 86400000)
  return diffDays >= 0 && diffDays <= 2
}

/**
 * Pure, deterministic scheduler evaluating whether a subscription is due
 * for an automated notification. Zero journal data is included in any payload.
 */
export function evaluateNotificationDue(
  sub: StoredSubscription,
  nowUtc: Date = new Date(),
  chapterEndingSoon?: boolean
): DueNotificationResult {
  const tz = sub.tz || 'UTC'
  let localTime: { dateStr: string; weekday: number; hour: number; minute: number }

  try {
    localTime = getLocalDateTimeInZone(nowUtc, tz)
  } catch {
    // Fallback to UTC if timezone is invalid
    localTime = getLocalDateTimeInZone(nowUtc, 'UTC')
  }

  const { dateStr, weekday, hour, minute } = localTime
  const currentMinutes = hour * 60 + minute
  const cronWindowMinutes = 20 // Accommodates 15-minute cron with minor execution jitter

  // 1. Monday Insights Reminder
  if (sub.prefs.mondayInsights && weekday === 1) {
    const targetMinutes = parseTimeToMinutes(sub.prefs.mondayInsightsTime || '09:00')
    if (
      currentMinutes >= targetMinutes &&
      currentMinutes < targetMinutes + cronWindowMinutes &&
      sub.lastSent?.mondayInsights !== dateStr
    ) {
      return {
        due: true,
        type: 'monday_insights',
        payload: {
          title: 'Trinqle Insights',
          body: 'Your weekly insights are ready to view.',
          url: '/?tab=insights',
          tag: 'monday-insights',
        },
        dateStr,
      }
    }
  }

  // 2. Chapter Ending Reminder (T-2 / T-1 / T-0)
  const resolvedChapterEndingSoon =
    chapterEndingSoon !== undefined
      ? chapterEndingSoon
      : isPlannedEndSoon(dateStr, sub.prefs.chapterPlannedEndDate)

  if (sub.prefs.chapterEnding && resolvedChapterEndingSoon) {
    const targetMinutes = parseTimeToMinutes('18:00') // 6:00 PM
    if (
      currentMinutes >= targetMinutes &&
      currentMinutes < targetMinutes + cronWindowMinutes &&
      sub.lastSent?.chapterEnding !== dateStr
    ) {
      return {
        due: true,
        type: 'chapter_ending',
        payload: {
          title: 'Trinqle Chapter',
          body: 'Your chapter wraps up soon. Remember to review your reflections.',
          url: '/?tab=home',
          tag: 'chapter-ending',
        },
        dateStr,
      }
    }
  }

  // 3. Daily Evening Journal Nudge
  if (sub.prefs.dailyReminder) {
    const targetMinutes = parseTimeToMinutes(sub.prefs.dailyReminderTime || '21:00')
    if (
      currentMinutes >= targetMinutes &&
      currentMinutes < targetMinutes + cronWindowMinutes &&
      sub.lastSent?.dailyReminder !== dateStr
    ) {
      return {
        due: true,
        type: 'daily',
        payload: {
          title: 'Trinqle',
          body: "Tonight's journal is ready.",
          url: '/',
          tag: 'daily-reminder',
        },
        dateStr,
      }
    }
  }

  return { due: false }
}
