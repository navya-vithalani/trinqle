/**
 * Compositional phrasing engine for Trinqle's Insights Engine per TRD Section 7.
 * Converts quantitative facts into plain, casual, blunt natural language sentences.
 * Zero fixed rigid templates; formats units, minutes, percentiles, and sample sizes.
 * Strictly ZERO emojis.
 */

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes)
  if (rounded < 60) return `${rounded}m`
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function formatValue(val: number, unit?: string): string {
  if (unit === 'minutes' || unit === 'min' || unit === 'hours') {
    return formatMinutes(val)
  }
  const formatted =
    Math.abs(val) >= 1000
      ? Math.round(val).toLocaleString()
      : Math.abs(val) >= 10
        ? Math.round(val).toString()
        : Number(val.toFixed(1)).toString()

  return unit ? `${formatted} ${unit}` : formatted
}

export function formatLag(lag: number): string {
  if (lag === 0) return 'Same day'
  if (lag === 1) return 'Next day'
  return `${lag} days later`
}

export function formatWeekday(dayNum: number): string {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return names[dayNum] || `Day ${dayNum}`
}

export interface PhrasingResult {
  headline: string
  facts: string[]
}

export function composeBinaryDriverPhrasing(
  driverLabel: string,
  outcomeLabel: string,
  mean1: number,
  mean0: number,
  n1: number,
  n0: number,
  lag: number,
  unit?: string
): PhrasingResult {
  const diff = mean1 - mean0
  const isPositive = diff > 0
  const diffAbs = Math.abs(diff)
  const diffStr = formatValue(diffAbs, unit)
  const mean1Str = formatValue(mean1, unit)
  const mean0Str = formatValue(mean0, unit)
  const totalN = n1 + n0

  let lagPrefix = ''
  if (lag === 1) lagPrefix = 'The day after'
  else if (lag > 1) lagPrefix = `${lag} days after`

  const headline = lagPrefix
    ? `${lagPrefix} you did ${driverLabel}, ${outcomeLabel} was ${isPositive ? 'higher' : 'lower'} (${diffStr})`
    : `On days you did ${driverLabel}, ${outcomeLabel} was ${isPositive ? 'higher' : 'lower'} (${diffStr})`

  const facts = [
    lagPrefix
      ? `${lagPrefix} logging ${driverLabel}, your ${outcomeLabel} averaged ${mean1Str} compared to ${mean0Str} on other days.`
      : `When you reported ${driverLabel}, ${outcomeLabel} averaged ${mean1Str} vs ${mean0Str} on days without it.`,
    `Observed across ${totalN} days (${n1} with ${driverLabel}, ${n0} without).`,
  ]

  return { headline, facts }
}

export function composeNumericDriverPhrasing(
  driverLabel: string,
  outcomeLabel: string,
  rho: number,
  n: number,
  lag: number,
  driverUnit?: string,
  outcomeUnit?: string
): PhrasingResult {
  const isPositive = rho > 0
  const strength =
    Math.abs(rho) > 0.6 ? 'strongly' : Math.abs(rho) > 0.4 ? 'moderately' : 'consistently'

  let lagNote = ''
  if (lag === 1) lagNote = ' (following day)'
  else if (lag > 1) lagNote = ` (${lag} days later)`

  const headline = isPositive
    ? `Higher ${driverLabel} ${strength} correlates with higher ${outcomeLabel}${lagNote}`
    : `Higher ${driverLabel} ${strength} correlates with lower ${outcomeLabel}${lagNote}`

  const dUnit = driverUnit ? ` (${driverUnit})` : ''
  const oUnit = outcomeUnit ? ` (${outcomeUnit})` : ''

  const facts = [
    `Rank correlation of ${rho.toFixed(2)} between ${driverLabel}${dUnit} and ${outcomeLabel}${oUnit} over ${n} days.`,
    lag > 0
      ? `The relationship holds with a ${lag}-day lag: variations in ${driverLabel} reflect in ${outcomeLabel} ${lag} day${lag === 1 ? '' : 's'} later.`
      : `Higher values of ${driverLabel} regularly coincide with ${isPositive ? 'elevated' : 'reduced'} ${outcomeLabel}.`,
  ]

  return { headline, facts }
}

export function composeWeekdayPhrasing(
  weekdayNum: number,
  outcomeLabel: string,
  dayMean: number,
  otherMean: number,
  diff: number,
  unit?: string
): PhrasingResult {
  const dayName = formatWeekday(weekdayNum)
  const isHigher = diff > 0
  const diffStr = formatValue(Math.abs(diff), unit)
  const dayMeanStr = formatValue(dayMean, unit)
  const otherMeanStr = formatValue(otherMean, unit)

  const headline = `${dayName}s average ${isHigher ? 'higher' : 'lower'} ${outcomeLabel} (${diffStr})`
  const facts = [
    `${dayName}s show a noticeable pattern, averaging ${dayMeanStr} vs ${otherMeanStr} across all other days of the week.`,
    `A regular weekly shift of ${diffStr} observed consistently.`,
  ]

  return { headline, facts }
}

export function composeChangePointPhrasing(
  metricLabel: string,
  splitDate: string,
  preMean: number,
  postMean: number,
  diff: number,
  unit?: string
): PhrasingResult {
  const isDrop = diff < 0
  const diffStr = formatValue(Math.abs(diff), unit)
  const preMeanStr = formatValue(preMean, unit)
  const postMeanStr = formatValue(postMean, unit)

  const headline = `${metricLabel} ${isDrop ? 'dropped' : 'stepped up'} by ${diffStr} around ${splitDate}`
  const facts = [
    `A sustained baseline shift detected around ${splitDate}: average moved from ${preMeanStr} prior to ${postMeanStr} afterward.`,
    `This represents a statistically significant change point in your routine.`,
  ]

  return { headline, facts }
}

export function composeAnomalyOutlierPhrasing(
  metricLabel: string,
  date: string,
  val: number,
  medianVal: number,
  z: number,
  unit?: string
): PhrasingResult {
  const isHigh = z > 0
  const valStr = formatValue(val, unit)
  const medStr = formatValue(medianVal, unit)

  const headline = `Unusual ${isHigh ? 'peak' : 'dip'} in ${metricLabel} on ${date}`
  const facts = [
    `On ${date}, ${metricLabel} reached ${valStr}, a robust deviation of ${z.toFixed(1)} standard units from your typical median (${medStr}).`,
    `One of your most exceptional recorded days for this metric.`,
  ]

  return { headline, facts }
}

export function composeLibraryLagPhrasing(
  itemA: string,
  itemB: string,
  lag: number,
  coOccurPct: number,
  baselinePct: number,
  coOccurCount: number
): PhrasingResult {
  const coPct = Math.round(coOccurPct * 100)
  const basePct = Math.round(baselinePct * 100)
  const lagStr = lag === 1 ? 'the next day' : `${lag} days later`

  const headline = `"${itemB}" frequently appears ${lagStr} after "${itemA}"`
  const facts = [
    `"${itemB}" was recorded on ${coPct}% of days ${lagStr} after you logged "${itemA}" (occurred ${coOccurCount} times).`,
    `Baseline frequency for "${itemB}" is only ${basePct}% across other days.`,
  ]

  return { headline, facts }
}

export function composeRoughStretchPhrasing(
  metricLabel: string,
  startDate: string,
  endDate: string,
  daysCount: number,
  avgVal: number,
  medianVal: number,
  isLow: boolean,
  unit?: string
): PhrasingResult {
  const avgStr = formatValue(avgVal, unit)
  const medStr = formatValue(medianVal, unit)

  const headline = `${daysCount}-day ${isLow ? 'rough' : 'peak'} stretch for ${metricLabel} (${startDate} to ${endDate})`
  const facts = [
    `Across ${daysCount} consecutive days from ${startDate} to ${endDate}, ${metricLabel} averaged ${avgStr} (compared to typical median of ${medStr}).`,
    `A prolonged consecutive cluster significantly outside your typical range.`,
  ]

  return { headline, facts }
}

export function composeStreakRecordPhrasing(
  metricLabel: string,
  streakCount: number,
  isCurrent: boolean
): PhrasingResult {
  const headline = isCurrent
    ? `Current active streak for ${metricLabel} has reached ${streakCount} days`
    : `All-time longest streak for ${metricLabel} reached ${streakCount} days`

  const facts = [
    `Maintained ${metricLabel} consecutively for ${streakCount} days without interruption.`,
    isCurrent
      ? 'This is your active running streak.'
      : 'Your personal record for consecutive consistency on this habit.',
  ]

  return { headline, facts }
}

export function composeBestDaysPhrasing(
  driverLabel: string,
  topPct: number,
  restPct: number,
  topN: number
): PhrasingResult {
  const topRound = Math.round(topPct * 100)
  const restRound = Math.round(restPct * 100)

  const headline = `Your highest-rated days strongly featured ${driverLabel}`
  const facts = [
    `On your top 25% best days, ${driverLabel} was present ${topRound}% of the time vs ${restRound}% on other days.`,
    `Based on your top ${topN} rated days.`,
  ]

  return { headline, facts }
}
