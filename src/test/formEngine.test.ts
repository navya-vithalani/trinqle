import { describe, it, expect } from 'vitest'
import {
  isQuestionVisible,
  visibleQuestions,
  checkCompleteness,
  checkOverlappingTimeRanges,
} from '../core/formEngine'
import type { Question, Part, Answer } from '../data/types'

describe('Form Engine (Phase 2)', () => {
  const mockQuestions: Question[] = [
    {
      id: 'q_mood',
      sectionId: 'sec_state',
      label: 'Inner State',
      order: 0,
      repeats: false,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'q_study',
      sectionId: 'sec_act',
      label: 'Studies',
      order: 1,
      repeats: true,
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'q_conditional',
      sectionId: 'sec_extra',
      label: 'Special Question',
      order: 2,
      repeats: false,
      showWhen: { partId: 'p_study_did', op: 'truthy' },
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'q_weekend_only',
      sectionId: 'sec_extra',
      label: 'Weekend Reflection',
      order: 3,
      repeats: false,
      schedule: { weekdays: [0, 6] }, // Sun, Sat
      createdAt: 0,
      updatedAt: 0,
    },
  ]

  const mockParts: Part[] = [
    {
      id: 'p_mood_val',
      questionId: 'q_mood',
      kind: 'scale',
      label: 'Mood rating',
      order: 0,
      level: 'core',
      config: { min: 0, max: 10, step: 0.5, display: 'slider' },
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_study_did',
      questionId: 'q_study',
      kind: 'yesno',
      label: 'Did you study today?',
      order: 0,
      level: 'core',
      gate: true,
      config: {},
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_study_time',
      questionId: 'q_study',
      kind: 'timerange',
      label: 'Study session',
      order: 1,
      level: 'core',
      config: {},
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_study_notes',
      questionId: 'q_study',
      kind: 'text',
      label: 'Study notes',
      order: 2,
      level: 'extra', // extra
      config: {},
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_cond_text',
      questionId: 'q_conditional',
      kind: 'text',
      label: 'What did you learn?',
      order: 0,
      level: 'core',
      config: {},
      createdAt: 0,
      updatedAt: 0,
    },
    {
      id: 'p_weekend_val',
      questionId: 'q_weekend_only',
      kind: 'scale',
      label: 'Week rating',
      order: 0,
      level: 'core',
      config: {},
      createdAt: 0,
      updatedAt: 0,
    },
  ]

  const snapshot = { questions: mockQuestions, parts: mockParts }

  it('evaluates conditional visibility (showWhen and schedule)', () => {
    // q_conditional depends on p_study_did being truthy
    const noAnswers: Answer[] = []
    expect(isQuestionVisible(mockQuestions[2], snapshot, noAnswers, '2026-10-15', false)).toBe(false)

    const studyDoneAnswers: Answer[] = [
      {
        id: '1',
        date: '2026-10-15',
        questionId: 'q_study',
        partId: 'p_study_did',
        instance: 0,
        value: true,
        createdAt: 0,
        updatedAt: 0,
      },
    ]
    expect(isQuestionVisible(mockQuestions[2], snapshot, studyDoneAnswers, '2026-10-15', false)).toBe(true)

    // Schedule check: 2026-10-15 is Thursday (weekday 4). Weekend reflection is only 0 (Sun) and 6 (Sat)
    expect(isQuestionVisible(mockQuestions[3], snapshot, [], '2026-10-15', false)).toBe(false)
    // 2026-10-18 is Sunday (weekday 0)
    expect(isQuestionVisible(mockQuestions[3], snapshot, [], '2026-10-18', false)).toBe(true)
  })

  it('filters visible questions in Quick mode vs Full mode', () => {
    // In Quick mode without expandedMore, only questions with at least one core part are included
    const quickQs = visibleQuestions(snapshot, '2026-10-15', 'quick', [], false, false)
    expect(quickQs.map((q) => q.id)).toContain('q_mood')
    expect(quickQs.map((q) => q.id)).toContain('q_study')
    // q_conditional is hidden because study_did is not truthy
    expect(quickQs.map((q) => q.id)).not.toContain('q_conditional')
  })

  it('enforces gate completeness rule: sibling core parts required ONLY when gate is on', () => {
    // Case 1: gate p_study_did is false (No)
    // Core yesno starts at false and counts as answered. Because gate is false, p_study_time is NOT required!
    const answersGateOff: Answer[] = [
      {
        id: '1',
        date: '2026-10-15',
        questionId: 'q_mood',
        partId: 'p_mood_val',
        instance: 0,
        value: 7.5,
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: '2',
        date: '2026-10-15',
        questionId: 'q_study',
        partId: 'p_study_did',
        instance: 0,
        value: false, // gate is OFF
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const resGateOff = checkCompleteness(snapshot, '2026-10-15', 'quick', answersGateOff, false)
    expect(resGateOff.complete).toBe(true)
    expect(resGateOff.missingPartIds).toEqual([])

    // Case 2: gate p_study_did is true (Yes), but study session time range is missing
    const answersGateOnMissingTime: Answer[] = [
      {
        id: '1',
        date: '2026-10-15',
        questionId: 'q_mood',
        partId: 'p_mood_val',
        instance: 0,
        value: 7.5,
        createdAt: 0,
        updatedAt: 0,
      },
      {
        id: '2',
        date: '2026-10-15',
        questionId: 'q_study',
        partId: 'p_study_did',
        instance: 0,
        value: true, // gate is ON!
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const resGateOn = checkCompleteness(snapshot, '2026-10-15', 'quick', answersGateOnMissingTime, false)
    expect(resGateOn.complete).toBe(false)
    expect(resGateOn.missingPartIds).toContain('p_study_time')

    // Case 3: gate on and session provided -> complete!
    const answersGateOnFilled: Answer[] = [
      ...answersGateOnMissingTime,
      {
        id: '3',
        date: '2026-10-15',
        questionId: 'q_study',
        partId: 'p_study_time',
        instance: 0,
        value: { start: '14:00', end: '16:00', crossesMidnight: false },
        createdAt: 0,
        updatedAt: 0,
      },
    ]

    const resGateOnFilled = checkCompleteness(snapshot, '2026-10-15', 'quick', answersGateOnFilled, false)
    // Note: q_conditional is now visible because p_study_did is true, so p_cond_text is required
    expect(resGateOnFilled.missingPartIds).toContain('p_cond_text')

    // Add p_cond_text
    const answersAllFilled: Answer[] = [
      ...answersGateOnFilled,
      {
        id: '4',
        date: '2026-10-15',
        questionId: 'q_conditional',
        partId: 'p_cond_text',
        instance: 0,
        value: 'Learned Vitest and React testing',
        createdAt: 0,
        updatedAt: 0,
      },
    ]
    const resFinal = checkCompleteness(snapshot, '2026-10-15', 'quick', answersAllFilled, false)
    expect(resFinal.complete).toBe(true)
  })

  it('detects overlapping time ranges correctly', () => {
    // Non-overlapping
    const nonOverlapping = [
      { start: '09:00', end: '11:00', crossesMidnight: false },
      { start: '13:00', end: '15:00', crossesMidnight: false },
    ]
    expect(checkOverlappingTimeRanges(nonOverlapping)).toBe(false)

    // Overlapping
    const overlapping = [
      { start: '10:00', end: '12:00', crossesMidnight: false },
      { start: '11:30', end: '13:30', crossesMidnight: false },
    ]
    expect(checkOverlappingTimeRanges(overlapping)).toBe(true)

    // Midnight crossing
    const midnightOverlap = [
      { start: '23:00', end: '01:00', crossesMidnight: true },
      { start: '00:30', end: '02:00', crossesMidnight: true },
    ]
    expect(checkOverlappingTimeRanges(midnightOverlap)).toBe(true)
  })

  it('F1: ignores core parts on sub-questions when parent gate is false, and requires them when true', () => {
    const gatedWithSubSnapshot = {
      questions: [
        {
          id: 'q_sleep',
          sectionId: 'sec_routine',
          label: 'Sleep',
          order: 0,
          repeats: true,
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: 'q_dream',
          sectionId: 'sec_routine',
          parentId: 'q_sleep',
          label: 'Dream',
          order: 1,
          repeats: false,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      parts: [
        {
          id: 'p_sleep_gate',
          questionId: 'q_sleep',
          kind: 'yesno' as const,
          label: 'Did you sleep?',
          order: 0,
          level: 'core' as const,
          gate: true,
          config: {},
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: 'p_sleep_time',
          questionId: 'q_sleep',
          kind: 'timerange' as const,
          label: 'Sleep window',
          order: 1,
          level: 'core' as const,
          config: {},
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: 'p_dream_gate',
          questionId: 'q_dream',
          kind: 'yesno' as const,
          label: 'Remember a dream?',
          order: 0,
          level: 'core' as const,
          gate: true,
          config: {},
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: 'p_dream_vivid',
          questionId: 'q_dream',
          kind: 'scale' as const,
          label: 'Vividness',
          order: 1,
          level: 'core' as const,
          config: { min: 1, max: 10, step: 1, display: 'slider' },
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    }

    // 1. Blank gate -> missing p_sleep_gate only (not p_sleep_time, p_dream_gate, p_dream_vivid)
    const resBlank = checkCompleteness(gatedWithSubSnapshot, '2026-10-15', 'quick', [], false)
    expect(resBlank.complete).toBe(false)
    expect(resBlank.missingPartIds).toEqual(['p_sleep_gate'])

    // 2. Parent gate = false -> complete! Sub-question core parts must NOT block submit
    const gateNo: Answer[] = [
      { id: 'a1', date: '2026-10-15', questionId: 'q_sleep', partId: 'p_sleep_gate', instance: 0, value: false, createdAt: 0, updatedAt: 0 },
    ]
    const resNo = checkCompleteness(gatedWithSubSnapshot, '2026-10-15', 'quick', gateNo, false)
    expect(resNo.complete).toBe(true)
    expect(resNo.missingPartIds).toEqual([])

    // 3. Parent gate = true -> p_sleep_time and p_dream_gate are required, p_dream_vivid is gated by p_dream_gate
    const gateYes: Answer[] = [
      { id: 'a1', date: '2026-10-15', questionId: 'q_sleep', partId: 'p_sleep_gate', instance: 0, value: true, createdAt: 0, updatedAt: 0 },
    ]
    const resYes = checkCompleteness(gatedWithSubSnapshot, '2026-10-15', 'quick', gateYes, false)
    expect(resYes.complete).toBe(false)
    expect(resYes.missingPartIds).toContain('p_sleep_time')
    expect(resYes.missingPartIds).toContain('p_dream_gate')
    expect(resYes.missingPartIds).not.toContain('p_dream_vivid')

    // 4. Parent gate = true, sleep time filled, sub-question gate = false -> complete!
    const subGateNo: Answer[] = [
      ...gateYes,
      { id: 'a2', date: '2026-10-15', questionId: 'q_sleep', partId: 'p_sleep_time', instance: 0, value: { start: '23:00', end: '07:00', crossesMidnight: true }, createdAt: 0, updatedAt: 0 },
      { id: 'a3', date: '2026-10-15', questionId: 'q_dream', partId: 'p_dream_gate', instance: 0, value: false, createdAt: 0, updatedAt: 0 },
    ]
    const resSubNo = checkCompleteness(gatedWithSubSnapshot, '2026-10-15', 'quick', subGateNo, false)
    expect(resSubNo.complete).toBe(true)

    // 5. Sub-question gate = true -> p_dream_vivid now required
    const subGateYes: Answer[] = [
      ...gateYes,
      { id: 'a2', date: '2026-10-15', questionId: 'q_sleep', partId: 'p_sleep_time', instance: 0, value: { start: '23:00', end: '07:00', crossesMidnight: true }, createdAt: 0, updatedAt: 0 },
      { id: 'a3', date: '2026-10-15', questionId: 'q_dream', partId: 'p_dream_gate', instance: 0, value: true, createdAt: 0, updatedAt: 0 },
    ]
    const resSubYes = checkCompleteness(gatedWithSubSnapshot, '2026-10-15', 'quick', subGateYes, false)
    expect(resSubYes.complete).toBe(false)
    expect(resSubYes.missingPartIds).toEqual(['p_dream_vivid'])
  })
})
