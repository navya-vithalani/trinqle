/**
 * Statistical calculations for Trinqle's offline Insights Engine.
 * Implements non-parametric tests, robust statistics, and FDR correction per TRD Section 7.
 * Zero external runtime dependencies; purely deterministic.
 */

/**
 * Abramowitz and Stegun numerical approximation for error function erf(x).
 * Error bounded: |eps| < 1.5e-7.
 */
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1
  const absX = Math.abs(x)

  const p = 0.3275911
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429

  const t = 1.0 / (1.0 + p * absX)
  const poly = t * (a1 + t * (a2 + t * (a3 + t * (a4 + t * a5))))
  const val = 1.0 - poly * Math.exp(-absX * absX)

  return sign * val
}

/**
 * Cumulative distribution function of the standard normal distribution N(0, 1).
 */
export function normalCdf(z: number): number {
  return 0.5 * (1.0 + erf(z / Math.SQRT2))
}

/**
 * Two-tailed p-value for a standard normal z-score.
 */
export function normalTwoTailedP(z: number): number {
  if (isNaN(z)) return 1.0
  const absZ = Math.abs(z)
  const p = 2.0 * (1.0 - normalCdf(absZ))
  return Math.min(1.0, Math.max(0.0, p))
}

/**
 * Incomplete Beta function continued fraction approximation for Student's t distribution.
 */
function betacf(a: number, b: number, x: number): number {
  const maxIt = 100
  const eps = 3e-7
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1.0
  let d = 1.0 - (qab * x) / qap
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1.0 / d
  let h = d

  for (let m = 1; m <= maxIt; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1.0 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1.0 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1.0 / d
    h *= d * c

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1.0 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1.0 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1.0 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1.0) < eps) break
  }
  return h
}

function logGamma(x: number): number {
  const coef = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.001208650973866179, -0.000005395239384953,
  ]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    ser += coef[j] / ++y
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return 0
  if (x === 0) return 0
  if (x === 1) return 1

  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1.0 - x))

  if (x < (a + 1.0) / (a + b + 2.0)) {
    return (bt * betacf(a, b, x)) / a
  } else {
    return 1.0 - (bt * betacf(b, a, 1.0 - x)) / b
  }
}

/**
 * Two-tailed p-value for Student's t distribution with df degrees of freedom.
 */
export function studentTTwoTailedP(t: number, df: number): number {
  if (isNaN(t) || df <= 0) return 1.0
  if (df >= 50) {
    // Normal approximation for large df
    return normalTwoTailedP(t)
  }
  const x = df / (df + t * t)
  const p = regularizedIncompleteBeta(df / 2.0, 0.5, x)
  return Math.min(1.0, Math.max(0.0, p))
}

/**
 * Computes fractional ranks for an array of numbers, handling ties by averaging ranks.
 * 1-indexed.
 */
export function rankData(arr: number[]): number[] {
  const n = arr.length
  const indexed = arr.map((val, idx) => ({ val, idx }))
  indexed.sort((a, b) => a.val - b.val)

  const ranks = new Array<number>(n)
  let i = 0
  while (i < n) {
    let j = i
    while (j + 1 < n && indexed[j + 1].val === indexed[i].val) {
      j++
    }
    // Average rank for tie group
    const avgRank = (i + 1 + (j + 1)) / 2.0
    for (let k = i; k <= j; k++) {
      ranks[indexed[k].idx] = avgRank
    }
    i = j + 1
  }
  return ranks
}

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  const sum = arr.reduce((acc, v) => acc + v, 0)
  return sum / arr.length
}

export function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2.0
  }
  return sorted[mid]
}

export function standardDeviation(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

export interface MannWhitneyResult {
  u1: number
  u0: number
  z: number
  pValue: number
  cliffsDelta: number
  n1: number
  n0: number
  median1: number
  median0: number
  mean1: number
  mean0: number
}

/**
 * Mann-Whitney U test (Wilcoxon rank-sum test) for binary driver vs continuous outcome.
 * Group 1: Driver present (true / 1)
 * Group 0: Driver absent (false / 0)
 */
export function mannWhitneyU(group1: number[], group0: number[]): MannWhitneyResult {
  const n1 = group1.length
  const n0 = group0.length

  const defaultRes: MannWhitneyResult = {
    u1: 0,
    u0: 0,
    z: 0,
    pValue: 1.0,
    cliffsDelta: 0,
    n1,
    n0,
    median1: median(group1),
    median0: median(group0),
    mean1: mean(group1),
    mean0: mean(group0),
  }

  if (n1 === 0 || n0 === 0) return defaultRes

  // Combine both groups and assign ranks
  const combined = [
    ...group1.map((v) => ({ val: v, group: 1 })),
    ...group0.map((v) => ({ val: v, group: 0 })),
  ]
  combined.sort((a, b) => a.val - b.val)

  const N = n1 + n0
  let rankSum1 = 0
  let tieCorrection = 0

  let i = 0
  while (i < N) {
    let j = i
    while (j + 1 < N && combined[j + 1].val === combined[i].val) {
      j++
    }
    const tieCount = j - i + 1
    if (tieCount > 1) {
      tieCorrection += tieCount * tieCount * tieCount - tieCount
    }
    const avgRank = (i + 1 + (j + 1)) / 2.0
    for (let k = i; k <= j; k++) {
      if (combined[k].group === 1) {
        rankSum1 += avgRank
      }
    }
    i = j + 1
  }

  const u1 = rankSum1 - (n1 * (n1 + 1)) / 2.0
  const u0 = n1 * n0 - u1

  // Cliff's delta: (u1 - u0) / (n1 * n0) in [-1, 1]
  const cliffsDelta = (u1 - u0) / (n1 * n0)

  // Asymptotic normal approximation
  const tieFactor = N > 1 ? tieCorrection / (N * (N - 1)) : 0
  const variance = (n1 * n0 * (N + 1 - tieFactor)) / 12.0

  let z = 0
  if (variance > 0) {
    const meanU = (n1 * n0) / 2.0
    z = (u1 - meanU) / Math.sqrt(variance)
  }

  const pValue = normalTwoTailedP(z)

  return {
    u1,
    u0,
    z,
    pValue,
    cliffsDelta,
    n1,
    n0,
    median1: median(group1),
    median0: median(group0),
    mean1: mean(group1),
    mean0: mean(group0),
  }
}

export interface SpearmanResult {
  rho: number
  tStat: number
  pValue: number
  n: number
}

/**
 * Spearman rank correlation coefficient for continuous driver vs continuous outcome.
 */
export function spearmanCorrelation(x: number[], y: number[]): SpearmanResult {
  const n = Math.min(x.length, y.length)
  if (n < 2) {
    return { rho: 0, tStat: 0, pValue: 1.0, n }
  }

  const rx = rankData(x.slice(0, n))
  const ry = rankData(y.slice(0, n))

  const meanRx = (n + 1) / 2.0
  const meanRy = (n + 1) / 2.0

  let num = 0
  let denX = 0
  let denY = 0

  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanRx
    const dy = ry[i] - meanRy
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }

  const den = Math.sqrt(denX * denY)
  if (den === 0) {
    return { rho: 0, tStat: 0, pValue: 1.0, n }
  }

  const rho = Math.min(1.0, Math.max(-1.0, num / den))
  const df = n - 2
  if (df <= 0) {
    return { rho, tStat: 0, pValue: 1.0, n }
  }
  const tStat = Math.abs(rho) >= 0.99999 ? 999 : (rho * Math.sqrt(df)) / Math.sqrt(1 - rho * rho)
  const pValue = studentTTwoTailedP(tStat, df)

  return { rho, tStat, pValue, n }
}

/**
 * Benjamini-Hochberg False Discovery Rate (FDR) procedure.
 * Given an array of unadjusted p-values, returns FDR-adjusted q-values.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const m = pValues.length
  if (m === 0) return []

  const indexed = pValues.map((p, idx) => ({ p: isNaN(p) ? 1.0 : p, idx }))
  indexed.sort((a, b) => a.p - b.p)

  const qValues = new Array<number>(m)
  let currentMinQ = 1.0

  // Step backwards from largest rank m to 1
  for (let rank = m; rank >= 1; rank--) {
    const item = indexed[rank - 1]
    const qRaw = (item.p * m) / rank
    currentMinQ = Math.min(currentMinQ, qRaw)
    qValues[item.idx] = Math.min(1.0, Math.max(0.0, currentMinQ))
  }

  return qValues
}

export interface WeekdayDetrendResult {
  detrendedValues: (number | null)[]
  weekdayMeans: number[]
  hasEnoughData: boolean // true if all 7 weekdays have >= 5 observations
}

/**
 * Detrend weekday effect (subtract weekday means) when n >= 5 per weekday;
 * otherwise preserves original values per TRD Section 7.
 */
export function detrendWeekday(
  dates: string[],
  values: (number | null)[]
): WeekdayDetrendResult {
  const weekdayBuckets: number[][] = [[], [], [], [], [], [], []]

  for (let i = 0; i < dates.length; i++) {
    const val = values[i]
    if (val !== null && !isNaN(val)) {
      const d = new Date(dates[i] + 'T00:00:00')
      const wd = d.getDay()
      weekdayBuckets[wd].push(val)
    }
  }

  const hasEnoughData = weekdayBuckets.every((b) => b.length >= 5)
  const weekdayMeans = weekdayBuckets.map((b) => (b.length > 0 ? mean(b) : 0))

  if (!hasEnoughData) {
    return {
      detrendedValues: values,
      weekdayMeans,
      hasEnoughData: false,
    }
  }

  const overallMean = mean(values.filter((v): v is number => v !== null && !isNaN(v)))

  const detrendedValues = values.map((val, idx) => {
    if (val === null || isNaN(val)) return null
    const d = new Date(dates[idx] + 'T00:00:00')
    const wd = d.getDay()
    // Subtract weekday baseline offset: val - (weekdayMean - overallMean)
    return val - (weekdayMeans[wd] - overallMean)
  })

  return {
    detrendedValues,
    weekdayMeans,
    hasEnoughData: true,
  }
}

export interface RobustZResult {
  zScores: number[]
  medianVal: number
  mad: number
  outlierIndices: number[] // |z| >= 3.0
}

/**
 * Calculates robust z-scores using Median and Median Absolute Deviation (MAD).
 * Standardized scale: 1.4826 * MAD (matches standard deviation for normal distribution).
 */
export function calculateRobustZ(values: number[]): RobustZResult {
  if (values.length === 0) {
    return { zScores: [], medianVal: 0, mad: 0, outlierIndices: [] }
  }

  const med = median(values)
  const absDevs = values.map((v) => Math.abs(v - med))
  const mad = median(absDevs)

  const scale = mad > 0 ? 1.4826 * mad : standardDeviation(values) || 1.0

  const zScores = values.map((v) => (v - med) / scale)
  const outlierIndices = zScores
    .map((z, idx) => ({ z, idx }))
    .filter((item) => Math.abs(item.z) >= 3.0)
    .map((item) => item.idx)

  return {
    zScores,
    medianVal: med,
    mad,
    outlierIndices,
  }
}

export interface ChangePointResult {
  splitIndex: number
  splitDate: string
  preMean: number
  postMean: number
  diff: number
  pValue: number
  z: number
}

/**
 * Step shift detection via Cumulative Sum (CUSUM) deviations.
 * Finds significant step change in continuous metric series.
 */
export function detectChangePoints(
  dates: string[],
  values: number[]
): ChangePointResult | null {
  const n = values.length
  if (n < 20) return null

  const overallMean = mean(values)
  const cusum: number[] = new Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += values[i] - overallMean
    cusum[i] = sum
  }

  // Find split point maximizing CUSUM range deviation
  let bestIdx = -1
  let maxDeviation = 0

  // Only consider splits with at least 8 observations on either side
  for (let i = 8; i < n - 8; i++) {
    const dev = Math.abs(cusum[i])
    if (dev > maxDeviation) {
      maxDeviation = dev
      bestIdx = i
    }
  }

  if (bestIdx < 0) return null

  const preValues = values.slice(0, bestIdx)
  const postValues = values.slice(bestIdx)

  const preM = mean(preValues)
  const postM = mean(postValues)
  const diff = postM - preM

  // Test significance using Mann-Whitney U test between pre and post
  const mwu = mannWhitneyU(postValues, preValues)
  if (mwu.pValue > 0.01) return null

  return {
    splitIndex: bestIdx,
    splitDate: dates[bestIdx],
    preMean: preM,
    postMean: postM,
    diff,
    pValue: mwu.pValue,
    z: mwu.z,
  }
}

/**
 * Two-proportion z-test for difference between two independent proportions.
 * Used for library lag co-occurrences and best-days driver prevalence.
 */
export function twoProportionZTest(
  k1: number,
  n1: number,
  k0: number,
  n0: number
): { z: number; pValue: number } {
  if (n1 <= 0 || n0 <= 0) return { z: 0, pValue: 1.0 }
  const p1 = k1 / n1
  const p0 = k0 / n0
  const pooledP = (k1 + k0) / (n1 + n0)
  if (pooledP <= 0 || pooledP >= 1) return { z: 0, pValue: 1.0 }

  const se = Math.sqrt(pooledP * (1.0 - pooledP) * (1.0 / n1 + 1.0 / n0))
  if (se <= 0) return { z: 0, pValue: 1.0 }

  const z = (p1 - p0) / se
  return { z, pValue: normalTwoTailedP(z) }
}
