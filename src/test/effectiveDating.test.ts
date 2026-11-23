import { describe, it, expect } from 'vitest'
import { isActiveOnDate, filterActiveItems } from '../core/effectiveDating'

describe('Effective Dating Helpers', () => {
  it('handles items with no validity bounds', () => {
    const item = {}
    expect(isActiveOnDate(item, '2026-01-01')).toBe(true)
    expect(isActiveOnDate(item, '2030-12-31')).toBe(true)
  })

  it('handles validFrom lower bound', () => {
    const item = { validFrom: '2026-05-01' }
    expect(isActiveOnDate(item, '2026-04-30')).toBe(false)
    expect(isActiveOnDate(item, '2026-05-01')).toBe(true)
    expect(isActiveOnDate(item, '2026-05-02')).toBe(true)
  })

  it('handles validTo upper bound (exclusive)', () => {
    const item = { validTo: '2026-06-01' }
    expect(isActiveOnDate(item, '2026-05-31')).toBe(true)
    expect(isActiveOnDate(item, '2026-06-01')).toBe(false)
    expect(isActiveOnDate(item, '2026-06-02')).toBe(false)
  })

  it('handles both bounds simultaneously', () => {
    const item = { validFrom: '2026-05-01', validTo: '2026-06-01' }
    expect(isActiveOnDate(item, '2026-04-30')).toBe(false)
    expect(isActiveOnDate(item, '2026-05-01')).toBe(true)
    expect(isActiveOnDate(item, '2026-05-15')).toBe(true)
    expect(isActiveOnDate(item, '2026-06-01')).toBe(false)
  })

  it('filters an array of effective-dated items', () => {
    const items = [
      { id: '1', validFrom: '2026-01-01', validTo: '2026-02-01' },
      { id: '2', validFrom: '2026-02-01', validTo: '2026-03-01' },
      { id: '3', validFrom: '2026-02-15' },
    ]

    const activeAtFeb10 = filterActiveItems(items, '2026-02-10')
    expect(activeAtFeb10.map((i) => i.id)).toEqual(['2'])

    const activeAtFeb20 = filterActiveItems(items, '2026-02-20')
    expect(activeAtFeb20.map((i) => i.id)).toEqual(['2', '3'])
  })
})
