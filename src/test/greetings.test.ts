import { describe, it, expect } from 'vitest'
import {
  evaluateCondition,
  interpolateTokens,
  evaluateGreetings,
  type GreetingContext,
  type GreetingRule,
} from '../core/greetings'

describe('Greetings Engine (Phase 3)', () => {
  const baseContext: GreetingContext = {
    daysOfData: 10,
    loggingStreak: 5,
    missedYesterday: false,
    missedDaysLast3: 0,
    filledToday: false,
    formOpen: true,
    windowEnd: '03:00',
    timeOfDay: 'evening',
    weekday: 3,
    chapterNumber: 2,
    chapterDay: 12,
    chapterDaysLeft: 16,
    periodActive: false,
    periodDay: 0,
    memorableDayLast3: false,
    backupDaysAgo: 2,
  }

  it('evaluates comparison operators correctly', () => {
    expect(
      evaluateCondition({ key: 'daysOfData', op: '==', value: 10 }, baseContext)
    ).toBe(true)
    expect(
      evaluateCondition({ key: 'daysOfData', op: '>', value: 5 }, baseContext)
    ).toBe(true)
    expect(
      evaluateCondition({ key: 'daysOfData', op: '<', value: 5 }, baseContext)
    ).toBe(false)
    expect(
      evaluateCondition(
        { key: 'timeOfDay', op: 'in', value: ['evening', 'night'] },
        baseContext
      )
    ).toBe(true)
  })

  it('interpolates context tokens cleanly', () => {
    const template = 'Chapter {{chapterNumber}} has {{chapterDaysLeft}} days left.'
    expect(interpolateTokens(template, baseContext)).toBe(
      'Chapter 2 has 16 days left.'
    )
  })

  it('prioritizes higher priority tiers', () => {
    const rules: GreetingRule[] = [
      {
        id: 'low',
        priority: 2,
        when: [{ key: 'formOpen', op: '==', value: true }],
        lines: ['Low priority line.'],
      },
      {
        id: 'high',
        priority: 9,
        when: [{ key: 'loggingStreak', op: '>=', value: 5 }],
        lines: ['High streak tier: {{loggingStreak}} in a row.'],
      },
    ]

    const result = evaluateGreetings(baseContext, '2026-10-15', rules)
    expect(result.ruleId).toBe('high')
    expect(result.text).toBe('High streak tier: 5 in a row.')
  })

  it('matches first-ever greeting on empty daysOfData', () => {
    const freshContext: GreetingContext = {
      ...baseContext,
      daysOfData: 0,
      loggingStreak: 0,
    }

    const rules: GreetingRule[] = [
      {
        id: 'first-ever',
        priority: 10,
        when: [{ key: 'daysOfData', op: '==', value: 0 }],
        lines: ['Hi, nice to meet you.'],
      },
      {
        id: 'fallback',
        priority: 1,
        when: [],
        lines: ['Hello.'],
      },
    ]

    const res = evaluateGreetings(freshContext, '2026-10-01', rules)
    expect(res.ruleId).toBe('first-ever')
    expect(res.text).toBe('Hi, nice to meet you.')
  })
})
