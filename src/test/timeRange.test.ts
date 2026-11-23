import { describe, it, expect } from 'vitest'
import {
  timeToMinutes,
  minutesToTime,
  formatTime12h,
  calculateTimeRangeDuration,
  formatMinutesToHours,
} from '../ui/widgets/TimeRangeWidget'

describe('TimeRange Calculations & Widget Helpers', () => {
  it('converts 24h string to minutes from midnight correctly', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('03:00')).toBe(180)
    expect(timeToMinutes('12:30')).toBe(750)
    expect(timeToMinutes('23:00')).toBe(1380)
    expect(timeToMinutes('23:45')).toBe(1425)
  })

  it('converts minutes from midnight back to 24h string correctly', () => {
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(180)).toBe('03:00')
    expect(minutesToTime(750)).toBe('12:30')
    expect(minutesToTime(1380)).toBe('23:00')
    expect(minutesToTime(1425)).toBe('23:45')
  })

  it('formats 24h string into friendly 12h display', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM')
    expect(formatTime12h('03:15')).toBe('3:15 AM')
    expect(formatTime12h('12:00')).toBe('12:00 PM')
    expect(formatTime12h('13:45')).toBe('1:45 PM')
    expect(formatTime12h('23:00')).toBe('11:00 PM')
  })

  it('calculates duration for times crossing midnight', () => {
    // Normal human sleep e.g. 11:00 PM to 7:00 AM
    const sleep1 = calculateTimeRangeDuration('23:00', '07:00')
    expect(sleep1.durationMinutes).toBe(480)
    expect(sleep1.crossesMidnight).toBe(true)

    // Early night sleep e.g. 10:15 PM to 6:45 AM
    const sleep2 = calculateTimeRangeDuration('22:15', '06:45')
    expect(sleep2.durationMinutes).toBe(510)
    expect(sleep2.crossesMidnight).toBe(true)

    // Late sleep e.g. 1:30 AM to 9:00 AM (does not cross midnight in 24h sense)
    const sleep3 = calculateTimeRangeDuration('01:30', '09:00')
    expect(sleep3.durationMinutes).toBe(450)
    expect(sleep3.crossesMidnight).toBe(false)
  })

  it('calculates duration for same-day periods without crossing midnight', () => {
    const nap = calculateTimeRangeDuration('14:00', '15:30')
    expect(nap.durationMinutes).toBe(90)
    expect(nap.crossesMidnight).toBe(false)

    const workSession = calculateTimeRangeDuration('09:00', '17:00')
    expect(workSession.durationMinutes).toBe(480)
    expect(workSession.crossesMidnight).toBe(false)
  })

  it('formats minutes into human readable hours and minutes', () => {
    expect(formatMinutesToHours(480)).toBe('8h')
    expect(formatMinutesToHours(510)).toBe('8h 30m')
    expect(formatMinutesToHours(45)).toBe('45m')
    expect(formatMinutesToHours(90)).toBe('1h 30m')
  })
})
