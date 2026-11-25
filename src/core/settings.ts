import type { TrinqleDB } from '../data/db'
import { db as defaultDb } from '../data/db'
import { DEFAULT_WINDOW } from './logicalDay'

export interface AppSettings {
  userName: string
  formWindowStart: string // HH:mm
  formWindowEnd: string // HH:mm
  windowStartHour: number
  windowEndHour: number
  weekStart: 'Monday' | 'Sunday'
  timeFormat: '12h' | '24h'
}

export function parseHourFromHHMM(hhmm: string | undefined, fallback: number): number {
  if (!hhmm || typeof hhmm !== 'string') return fallback
  const [hStr] = hhmm.split(':')
  const h = parseInt(hStr, 10)
  if (isNaN(h) || h < 0 || h > 23) return fallback
  return h
}

export function formatTimeByPreference(t: string, timeFormat: '12h' | '24h' = '12h'): string {
  if (!t || !t.includes(':')) return t
  if (timeFormat === '24h') {
    const [hStr, mStr] = t.split(':')
    return `${String(parseInt(hStr, 10) || 0).padStart(2, '0')}:${mStr.padStart(2, '0')}`
  }
  const [hStr, mStr] = t.split(':')
  let h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${mStr} ${ampm}`
}

export async function loadAppSettings(db: TrinqleDB = defaultDb): Promise<AppSettings> {
  const rows = await db.settings.toArray()
  const map = new Map<string, unknown>(rows.map((r) => [r.key, r.value]))

  const userName = typeof map.get('user_name') === 'string' ? (map.get('user_name') as string) : ''

  const savedStart = map.get('form_window_start')
  const savedEnd = map.get('form_window_end')
  const legacyStartH = typeof map.get('windowStartHour') === 'number' ? (map.get('windowStartHour') as number) : DEFAULT_WINDOW.startHour
  const legacyEndH = typeof map.get('windowEndHour') === 'number' ? (map.get('windowEndHour') as number) : DEFAULT_WINDOW.endHour

  const formWindowStart =
    typeof savedStart === 'string' && savedStart.includes(':')
      ? savedStart
      : `${String(legacyStartH).padStart(2, '0')}:00`
  const formWindowEnd =
    typeof savedEnd === 'string' && savedEnd.includes(':')
      ? savedEnd
      : `${String(legacyEndH).padStart(2, '0')}:00`

  const rawWeek = map.get('week_start') ?? map.get('weekStart')
  const weekStart: 'Monday' | 'Sunday' =
    rawWeek === 'Sunday' || rawWeek === 0 ? 'Sunday' : 'Monday'

  const rawTime = map.get('time_format') ?? map.get('timeFormat')
  const timeFormat: '12h' | '24h' =
    rawTime === '24-hour' || rawTime === '24h' ? '24h' : '12h'

  return {
    userName,
    formWindowStart,
    formWindowEnd,
    windowStartHour: parseHourFromHHMM(formWindowStart, legacyStartH),
    windowEndHour: parseHourFromHHMM(formWindowEnd, legacyEndH),
    weekStart,
    timeFormat,
  }
}
