/**
 * Effective-dating helpers for schema items (Sections, Questions, Parts).
 *
 * Rules (PRD 5.3 & TRD 5):
 * - An item is active on date iff `validFrom <= date < validTo` (null = open).
 * - Past dates are judged against the form as it was effective on that date.
 */

export interface EffectiveDated {
  validFrom?: string | null
  validTo?: string | null
}

export function isActiveOnDate(
  item: EffectiveDated,
  date: string
): boolean {
  if (item.validFrom && item.validFrom > date) {
    return false
  }
  if (item.validTo && item.validTo <= date) {
    return false
  }
  return true
}

export function filterActiveItems<T extends EffectiveDated>(
  items: T[],
  date: string
): T[] {
  return items.filter((item) => isActiveOnDate(item, date))
}
