/**
 * Core Insights Generator for Trinqle per TRD Section 7 & Plan Phase 7.
 * Pure, deterministic engine generating candidate statistical findings,
 * applying Benjamini-Hochberg FDR correction, sureness/surprise scoring,
 * deduplication by signature, and compositional phrasing.
 * Zero emojis.
 */

import type { Day, Answer, Question, Part, AnswerLink, Item, Library, Cycle } from '../../data/types'
import { buildDailyMetricsTable } from '../metrics/calculator'
import type { CandidateTest, CandidateResult, EngineOptions, EngineRunOutput, EvidenceDay } from './types'
import {
  mannWhitneyU,
  spearmanCorrelation,
  benjaminiHochberg,
  calculateRobustZ,
  detectChangePoints,
  detrendWeekday,
  mean,
  standardDeviation,
  normalTwoTailedP,
  twoProportionZTest,
} from './stats'
import { formatValue } from './phrasing'
import {
  composeBinaryDriverPhrasing,
  composeNumericDriverPhrasing,
  composeWeekdayPhrasing,
  composeChangePointPhrasing,
  composeAnomalyOutlierPhrasing,
  composeLibraryLagPhrasing,
  composeRoughStretchPhrasing,
  composeStreakRecordPhrasing,
  composeBestDaysPhrasing,
} from './phrasing'

export interface GenerateInsightsInput {
  days: Day[]
  answers: Answer[]
  questions: Question[]
  parts: Part[]
  answerLinks?: AnswerLink[]
  items?: Item[]
  libraries?: Library[]
  cycles?: Cycle[]
  options?: EngineOptions
}

interface RawCandidate {
  test: CandidateTest
  n: number
  pValue: number
  effectSize: number
  direction: 'positive' | 'negative' | 'neutral'
  headline: string
  facts: string[]
  evidenceDays: EvidenceDay[]
  surprise: number
  signature: string
}

export function generateInsights(input: GenerateInsightsInput): EngineRunOutput {
  const {
    days,
    answers,
    questions,
    parts,
    answerLinks = [],
    items = [],
    cycles = [],
    options = {},
  } = input

  const bar = options.bar ?? 6.5
  const minShow = options.minShow ?? 20
  const minN = options.minN ?? 5
  const maxTests = options.maxTests ?? 50000
  const discardedSet = new Set(options.discardedSignatures || [])
  let testsEvaluated = 0
  let truncated = false

  // Sort days chronologically
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))
  const dates = sortedDays.map((d) => d.date)
  const windowStart = dates[0] || ''
  const windowEnd = dates[dates.length - 1] || ''
  const windowLabel =
    options.windowLabel || (dates.length > 0 ? `${windowStart} to ${windowEnd}` : 'Empty')
  const effectiveMinN = Math.min(minN, dates.length)

  if (sortedDays.length === 0) {
    return {
      windowStart,
      windowEnd,
      windowLabel,
      nGenerated: 0,
      nAboveBar: 0,
      bar,
      insights: [],
    }
  }

  // Build daily metrics table
  const dailyTable = buildDailyMetricsTable(sortedDays, answers, questions, parts)
  const rowsByDate = new Map(dailyTable.rows.map((r) => [r.date, r]))
  const dayByDate = new Map(sortedDays.map((d) => [d.date, d]))

  // Maps for quick lookup
  const itemMap = new Map(items.map((i) => [i.id, i]))

  // Build item presence per date from AnswerLinks
  // Map: itemId -> Set of dates
  const itemDates = new Map<string, Set<string>>()
  for (const link of answerLinks) {
    if (!itemDates.has(link.itemId)) {
      itemDates.set(link.itemId, new Set())
    }
    itemDates.get(link.itemId)!.add(link.date)
  }

  // Also include item presence from Answer value arrays
  for (const ans of answers) {
    if (Array.isArray(ans.value)) {
      for (const itId of ans.value) {
        if (typeof itId === 'string') {
          if (!itemDates.has(itId)) {
            itemDates.set(itId, new Set())
          }
          itemDates.get(itId)!.add(ans.date)
        }
      }
    }
  }

  // Identify Outcomes:
  // Continuous metrics: scales, numbers, timerange minutes, overallRating, memorability
  interface OutcomeSeries {
    key: string
    label: string
    kind: 'scale' | 'number' | 'timerange' | 'rating' | 'memorability'
    unit?: string
    values: (number | null)[]
    detrendedValues: (number | null)[]
    isWeekdayDetrended: boolean
  }

  const pushOutcome = (
    key: string,
    label: string,
    kind: OutcomeSeries['kind'],
    values: (number | null)[],
    unit?: string
  ) => {
    const dt = detrendWeekday(dates, values)
    outcomes.push({
      key,
      label,
      kind,
      unit,
      values,
      detrendedValues: dt.hasEnoughData ? dt.detrendedValues : values,
      isWeekdayDetrended: dt.hasEnoughData,
    })
  }

  const outcomes: OutcomeSeries[] = []

  // Add overallRating and memorability
  const ratingVals = dates.map((d) => dayByDate.get(d)?.overallRating ?? null)
  if (ratingVals.some((v) => v !== null)) {
    pushOutcome('derived.overallRating', 'Overall Day Rating', 'rating', ratingVals, '/10')
  }

  const memorabilityVals = dates.map((d) => dayByDate.get(d)?.memorability ?? null)
  if (memorabilityVals.some((v) => v !== null && v > 0)) {
    pushOutcome('derived.memorability', 'Day Memorability', 'memorability', memorabilityVals)
  }

  // Add registered metrics suitable as outcomes
  for (const m of dailyTable.metrics) {
    if (m.partKind === 'scale' || m.partKind === 'number' || m.partKind === 'timerange') {
      const vals = dates.map((d) => {
        const row = rowsByDate.get(d)
        return row?.values[m.key] ?? null
      })
      pushOutcome(
        m.key,
        `${m.questionLabel} (${m.label})`,
        m.partKind === 'timerange' ? 'timerange' : m.partKind === 'scale' ? 'scale' : 'number',
        vals,
        m.unit
      )
    }
  }

  // Identify Drivers:
  // Binary drivers: yesno.done, text.written, and item presence (for items with >= 3 occurrences)
  interface BinaryDriver {
    key: string
    label: string
    kind: 'yesno' | 'text' | 'item'
    values: (boolean | null)[]
  }

  const binaryDrivers: BinaryDriver[] = []

  // YesNo parts
  for (const m of dailyTable.metrics) {
    if (m.metric === 'done' || m.partKind === 'yesno') {
      const vals = dates.map((d) => {
        const r = rowsByDate.get(d)
        const v = r?.values[m.key]
        return v === null || v === undefined ? null : v > 0
      })
      binaryDrivers.push({
        key: m.key,
        label: `${m.questionLabel}: ${m.label}`,
        kind: 'yesno',
        values: vals,
      })
    } else if (m.metric === 'written' || m.partKind === 'text') {
      const vals = dates.map((d) => {
        const r = rowsByDate.get(d)
        const v = r?.values[m.key]
        return v === null || v === undefined ? null : v > 0
      })
      binaryDrivers.push({
        key: m.key,
        label: `${m.questionLabel} note`,
        kind: 'text',
        values: vals,
      })
    }
  }

  // Library items with >= 3 occurrences
  for (const [itemId, dateSet] of itemDates.entries()) {
    if (dateSet.size >= 3) {
      const it = itemMap.get(itemId)
      const itName = it?.name || itemId
      const vals = dates.map((d) => dateSet.has(d))
      binaryDrivers.push({
        key: `item:${itemId}`,
        label: itName,
        kind: 'item',
        values: vals,
      })
    }
  }

  // Continuous drivers: timerange minutes, numbers, scales
  interface ContinuousDriver {
    key: string
    label: string
    kind: 'timerange' | 'number' | 'scale'
    unit?: string
    values: (number | null)[]
  }

  const continuousDrivers: ContinuousDriver[] = []
  for (const m of dailyTable.metrics) {
    if (m.partKind === 'timerange' || m.partKind === 'number' || m.partKind === 'scale') {
      const vals = dates.map((d) => {
        const r = rowsByDate.get(d)
        return r?.values[m.key] ?? null
      })
      continuousDrivers.push({
        key: m.key,
        label: `${m.questionLabel}: ${m.label}`,
        kind: m.partKind as 'timerange' | 'number' | 'scale',
        unit: m.unit,
        values: vals,
      })
    }
  }

  const rawCandidates: RawCandidate[] = []

  // 1. Binary Driver vs Outcome (Mann-Whitney U) across lags 0..3
  for (const driver of binaryDrivers) {
    if (testsEvaluated >= maxTests) {
      truncated = true
      break
    }
    for (const outcome of outcomes) {
      if (driver.key === outcome.key) continue
      if (testsEvaluated >= maxTests) {
        truncated = true
        break
      }

      for (let lag = 0; lag <= 3; lag++) {
        if (testsEvaluated >= maxTests) {
          truncated = true
          break
        }
        const group1: number[] = []
        const group0: number[] = []
        const rawGroup1: number[] = []
        const rawGroup0: number[] = []
        const evidencePairs: EvidenceDay[] = []

        for (let i = 0; i < dates.length - lag; i++) {
          const dVal = driver.values[i]
          const oVal = outcome.detrendedValues[i + lag]
          const rawOVal = outcome.values[i + lag]
          if (dVal === null || oVal === null || rawOVal === null) continue

          const curDate = dates[i]
          const curDay = dayByDate.get(curDate)

          if (dVal) {
            group1.push(oVal)
            rawGroup1.push(rawOVal)
            evidencePairs.push({
              date: curDate,
              title: curDay?.title,
              oneliner: curDay?.oneliner,
              driverValue: true,
              outcomeValue: rawOVal,
            })
          } else {
            group0.push(oVal)
            rawGroup0.push(rawOVal)
          }
        }

        const totalN = group1.length + group0.length
        if (totalN < Math.min(2, effectiveMinN) || group1.length < 1 || group0.length < 1) continue

        testsEvaluated++
        const mwu = mannWhitneyU(group1, group0)
        const rawMean1 = mean(rawGroup1)
        const rawMean0 = mean(rawGroup0)
        const diff = rawMean1 - rawMean0
        const dir = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'

        const signature = `binary|${driver.key}|${outcome.key}|lag:${lag}|${dir}`
        if (discardedSet.has(signature)) continue

        const phrasing = composeBinaryDriverPhrasing(
          driver.label,
          outcome.label,
          rawMean1,
          rawMean0,
          rawGroup1.length,
          rawGroup0.length,
          lag,
          outcome.unit
        )

        // Surprise based on Cliff's delta magnitude and standardized difference
        const surprise = Math.min(10.0, Math.max(1.0, Math.abs(mwu.cliffsDelta) * 10.0))

        rawCandidates.push({
          test: {
            id: signature,
            testType: 'binary_outcome',
            driverKey: driver.key,
            driverLabel: driver.label,
            driverKind: driver.kind,
            outcomeKey: outcome.key,
            outcomeLabel: outcome.label,
            outcomeKind: outcome.kind,
            unit: outcome.unit,
            lag,
          },
          n: totalN,
          pValue: mwu.pValue,
          effectSize: mwu.cliffsDelta,
          direction: dir,
          headline: phrasing.headline,
          facts: phrasing.facts,
          evidenceDays: evidencePairs.slice(0, 5),
          surprise,
          signature,
        })
      }
    }
  }

  // 2. Continuous Driver vs Outcome (Spearman Rank Correlation) across lags 0..3
  for (const driver of continuousDrivers) {
    if (testsEvaluated >= maxTests) {
      truncated = true
      break
    }
    const driverDetrend = detrendWeekday(dates, driver.values)
    const driverSeries = driverDetrend.hasEnoughData ? driverDetrend.detrendedValues : driver.values

    for (const outcome of outcomes) {
      if (driver.key === outcome.key) continue
      if (testsEvaluated >= maxTests) {
        truncated = true
        break
      }

      for (let lag = 0; lag <= 3; lag++) {
        if (testsEvaluated >= maxTests) {
          truncated = true
          break
        }
        // At lag 0, avoid mirror duplicates when both are continuous metrics
        if (lag === 0 && continuousDrivers.some((d) => d.key === outcome.key) && driver.key > outcome.key) {
          continue
        }

        const xVals: number[] = []
        const yVals: number[] = []
        const evidencePairs: EvidenceDay[] = []

        for (let i = 0; i < dates.length - lag; i++) {
          const x = driverSeries[i]
          const y = outcome.detrendedValues[i + lag]
          const rawX = driver.values[i]
          const rawY = outcome.values[i + lag]
          if (x === null || y === null || rawX === null || rawY === null) continue

          xVals.push(x)
          yVals.push(y)

          const curDate = dates[i]
          const curDay = dayByDate.get(curDate)
          evidencePairs.push({
            date: curDate,
            title: curDay?.title,
            oneliner: curDay?.oneliner,
            driverValue: rawX,
            outcomeValue: rawY,
          })
        }

        if (xVals.length < Math.min(2, effectiveMinN)) continue

        testsEvaluated++
        const spearman = spearmanCorrelation(xVals, yVals)
        const dir = spearman.rho > 0 ? 'positive' : spearman.rho < 0 ? 'negative' : 'neutral'

        const signature = `numeric|${driver.key}|${outcome.key}|lag:${lag}|${dir}`
        if (discardedSet.has(signature)) continue

        const phrasing = composeNumericDriverPhrasing(
          driver.label,
          outcome.label,
          spearman.rho,
          xVals.length,
          lag,
          driver.unit,
          outcome.unit
        )

        const surprise = Math.min(10.0, Math.max(1.0, Math.abs(spearman.rho) * 10.0))

        rawCandidates.push({
          test: {
            id: signature,
            testType: 'numeric_outcome',
            driverKey: driver.key,
            driverLabel: driver.label,
            driverKind: driver.kind,
            outcomeKey: outcome.key,
            outcomeLabel: outcome.label,
            outcomeKind: outcome.kind,
            unit: outcome.unit,
            lag,
          },
          n: xVals.length,
          pValue: spearman.pValue,
          effectSize: spearman.rho,
          direction: dir,
          headline: phrasing.headline,
          facts: phrasing.facts,
          evidenceDays: evidencePairs.slice(0, 5),
          surprise,
          signature,
        })
      }
    }
  }

  // 3. Weekday Effects (Outcome across weekdays)
  for (const outcome of outcomes) {
    const validPoints = dates
      .map((d, idx) => ({ date: d, val: outcome.values[idx] }))
      .filter((p): p is { date: string; val: number } => p.val !== null && !isNaN(p.val))

    if (validPoints.length >= 14) {
      for (let weekdayNum = 0; weekdayNum < 7; weekdayNum++) {
        const dayVals = validPoints
          .filter((p) => new Date(p.date + 'T00:00:00').getDay() === weekdayNum)
          .map((p) => p.val)
        const otherVals = validPoints
          .filter((p) => new Date(p.date + 'T00:00:00').getDay() !== weekdayNum)
          .map((p) => p.val)

        if (dayVals.length >= 3 && otherVals.length >= 7) {
          const mwu = mannWhitneyU(dayVals, otherVals)
          const diff = mwu.mean1 - mwu.mean0
          const dir = diff > 0 ? 'positive' : 'negative'

          const signature = `weekday|${weekdayNum}|${outcome.key}|${dir}`
          if (discardedSet.has(signature)) continue

          const phrasing = composeWeekdayPhrasing(
            weekdayNum,
            outcome.label,
            mwu.mean1,
            mwu.mean0,
            diff,
            outcome.unit
          )

          const surprise = Math.min(10.0, Math.max(1.0, Math.abs(mwu.cliffsDelta) * 10.0))

          const evidencePairs: EvidenceDay[] = validPoints
            .filter((p) => new Date(p.date + 'T00:00:00').getDay() === weekdayNum)
            .slice(0, 5)
            .map((p) => {
              const day = dayByDate.get(p.date)
              return {
                date: p.date,
                title: day?.title,
                oneliner: day?.oneliner,
                outcomeValue: p.val,
              }
            })

          rawCandidates.push({
            test: {
              id: signature,
              testType: 'weekday_effect',
              driverKey: `weekday:${weekdayNum}`,
              driverLabel: `Day of week ${weekdayNum}`,
              driverKind: 'weekday',
              outcomeKey: outcome.key,
              outcomeLabel: outcome.label,
              outcomeKind: outcome.kind,
              unit: outcome.unit,
              lag: 0,
            },
            n: validPoints.length,
            pValue: mwu.pValue,
            effectSize: mwu.cliffsDelta,
            direction: dir,
            headline: phrasing.headline,
            facts: phrasing.facts,
            evidenceDays: evidencePairs,
            surprise,
            signature,
          })
        }
      }
    }
  }

  // 4. Library Lag Co-occurrences (Item A at day d and Item B at day d+k)
  const itemKeys = Array.from(itemDates.keys()).filter((itId) => itemDates.get(itId)!.size >= 3)
  for (let i = 0; i < itemKeys.length; i++) {
    for (let j = 0; j < itemKeys.length; j++) {
      if (i === j) continue
      const itemA = itemKeys[i]
      const itemB = itemKeys[j]
      const datesA = itemDates.get(itemA)!
      const datesB = itemDates.get(itemB)!

      for (let lag = 1; lag <= 3; lag++) {
        let aOccurrences = 0
        let coOccurrences = 0
        let otherDaysCount = 0
        let otherBOccurrences = 0

        for (let dIdx = 0; dIdx < dates.length - lag; dIdx++) {
          const curDate = dates[dIdx]
          const nextDate = dates[dIdx + lag]

          if (datesA.has(curDate)) {
            aOccurrences++
            if (datesB.has(nextDate)) {
              coOccurrences++
            }
          } else {
            otherDaysCount++
            if (datesB.has(nextDate)) {
              otherBOccurrences++
            }
          }
        }

        if (aOccurrences >= 3 && coOccurrences >= 2) {
          const coPct = coOccurrences / aOccurrences
          const baselinePct = otherDaysCount > 0 ? otherBOccurrences / otherDaysCount : 0

          // Check if co-occurrence rate exceeds baseline by at least 20 percentage points
          if (coPct > baselinePct + 0.2) {
            const zTest = twoProportionZTest(coOccurrences, aOccurrences, otherBOccurrences, otherDaysCount)
            if (zTest.z > 1.5) {
              const nameA = itemMap.get(itemA)?.name || itemA
              const nameB = itemMap.get(itemB)?.name || itemB

              const signature = `library_lag|${itemA}|${itemB}|lag:${lag}`
              if (discardedSet.has(signature)) continue

              const phrasing = composeLibraryLagPhrasing(nameA, nameB, lag, coPct, baselinePct, coOccurrences)
              const surprise = Math.min(10.0, Math.max(2.0, (coPct / Math.max(0.05, baselinePct)) * 2.5))

              rawCandidates.push({
                test: {
                  id: signature,
                  testType: 'library_lag',
                  driverKey: `item:${itemA}`,
                  driverLabel: nameA,
                  driverKind: 'item',
                  outcomeKey: `item:${itemB}`,
                  outcomeLabel: nameB,
                  outcomeKind: 'scale',
                  lag,
                },
                n: aOccurrences + otherDaysCount,
                pValue: zTest.pValue,
                effectSize: coPct - baselinePct,
                direction: 'positive',
                headline: phrasing.headline,
                facts: phrasing.facts,
                evidenceDays: [],
                surprise,
                signature,
              })
            }
          }
        }
      }
    }
  }

  // 5. Anomalies & Outliers (Robust z-score)
  for (const outcome of outcomes) {
    const validPairs = dates
      .map((d, idx) => ({ date: d, val: outcome.values[idx] }))
      .filter((p): p is { date: string; val: number } => p.val !== null && !isNaN(p.val))

    if (validPairs.length >= 10) {
      const vals = validPairs.map((p) => p.val)
      const robust = calculateRobustZ(vals)

      // Single extreme outlier (|z| >= 3.0) for continuous metrics with positive spread
      if (outcome.kind !== 'memorability' && robust.mad > 0 && robust.outlierIndices.length > 0) {
        // Find the single most extreme outlier for this metric
        let maxZIdx = robust.outlierIndices[0]
        let maxAbsZ = Math.abs(robust.zScores[maxZIdx])
        for (const idx of robust.outlierIndices) {
          const absZ = Math.abs(robust.zScores[idx])
          if (absZ > maxAbsZ) {
            maxAbsZ = absZ
            maxZIdx = idx
          }
        }

        const p = validPairs[maxZIdx]
        const z = robust.zScores[maxZIdx]
        const signature = `outlier|${outcome.key}|${p.date}`
        if (!discardedSet.has(signature)) {
          const pVal = normalTwoTailedP(z)
          const phrasing = composeAnomalyOutlierPhrasing(
            outcome.label,
            p.date,
            p.val,
            robust.medianVal,
            z,
            outcome.unit
          )
          const surprise = Math.min(10.0, Math.max(4.0, Math.abs(z) * 2.5))
          const day = dayByDate.get(p.date)

          rawCandidates.push({
            test: {
              id: signature,
              testType: 'anomaly_outlier',
              driverKey: outcome.key,
              driverLabel: outcome.label,
              driverKind: 'derived',
              outcomeKey: outcome.key,
              outcomeLabel: outcome.label,
              outcomeKind: outcome.kind,
              unit: outcome.unit,
              lag: 0,
            },
            n: validPairs.length,
            pValue: pVal,
            effectSize: z,
            direction: z > 0 ? 'positive' : 'negative',
            headline: phrasing.headline,
            facts: phrasing.facts,
            evidenceDays: [{ date: p.date, title: day?.title, oneliner: day?.oneliner, outcomeValue: p.val }],
            surprise,
            signature,
          })
        }
      }

      // Rough / Peak stretch: 4 consecutive days with robust deviation
      if (validPairs.length >= 15) {
        for (let i = 0; i <= validPairs.length - 4; i++) {
          const windowPairs = validPairs.slice(i, i + 4)
          const windowZ = robust.zScores.slice(i, i + 4)
          const avgZ = mean(windowZ)

          if (Math.abs(avgZ) >= 2.0) {
            const isLow = avgZ < 0
            const startDate = windowPairs[0].date
            const endDate = windowPairs[3].date
            const signature = `stretch|${outcome.key}|${startDate}|${endDate}`
            if (discardedSet.has(signature)) continue

            const avgVal = mean(windowPairs.map((p) => p.val))
            const phrasing = composeRoughStretchPhrasing(
              outcome.label,
              startDate,
              endDate,
              4,
              avgVal,
              robust.medianVal,
              isLow,
              outcome.unit
            )
            const pVal = Math.max(0.0001, normalTwoTailedP(avgZ * Math.sqrt(4)))
            const surprise = Math.min(10.0, Math.max(3.0, Math.abs(avgZ) * 3.0))

            const evidenceDays = windowPairs.map((wp) => {
              const d = dayByDate.get(wp.date)
              return { date: wp.date, title: d?.title, oneliner: d?.oneliner, outcomeValue: wp.val }
            })

            rawCandidates.push({
              test: {
                id: signature,
                testType: 'anomaly_stretch',
                driverKey: outcome.key,
                driverLabel: outcome.label,
                driverKind: 'derived',
                outcomeKey: outcome.key,
                outcomeLabel: outcome.label,
                outcomeKind: outcome.kind,
                unit: outcome.unit,
                lag: 0,
              },
              n: validPairs.length,
              pValue: pVal,
              effectSize: avgZ,
              direction: isLow ? 'negative' : 'positive',
              headline: phrasing.headline,
              facts: phrasing.facts,
              evidenceDays,
              surprise,
              signature,
            })
            // Skip forward to avoid overlapping duplicate stretch windows
            i += 3
          }
        }
      }
    }
  }

  // 6. Change Point Detection (CUSUM Step Shift)
  for (const outcome of outcomes) {
    const validPairs = dates
      .map((d, idx) => ({ date: d, val: outcome.values[idx] }))
      .filter((p): p is { date: string; val: number } => p.val !== null && !isNaN(p.val))

    if (validPairs.length >= 25) {
      const datesArr = validPairs.map((p) => p.date)
      const valsArr = validPairs.map((p) => p.val)
      const cp = detectChangePoints(datesArr, valsArr)

      if (cp) {
        const signature = `changepoint|${outcome.key}|${cp.splitDate}`
        if (!discardedSet.has(signature)) {
          const phrasing = composeChangePointPhrasing(
            outcome.label,
            cp.splitDate,
            cp.preMean,
            cp.postMean,
            cp.diff,
            outcome.unit
          )
          const stdVal = standardDeviation(valsArr) || 1.0
          const standardizedDiff = Math.abs(cp.diff) / stdVal
          const surprise = Math.min(10.0, Math.max(3.0, standardizedDiff * 4.0))

          rawCandidates.push({
            test: {
              id: signature,
              testType: 'changepoint',
              driverKey: outcome.key,
              driverLabel: outcome.label,
              driverKind: 'derived',
              outcomeKey: outcome.key,
              outcomeLabel: outcome.label,
              outcomeKind: outcome.kind,
              unit: outcome.unit,
              lag: 0,
            },
            n: validPairs.length,
            pValue: cp.pValue,
            effectSize: cp.diff,
            direction: cp.diff > 0 ? 'positive' : 'negative',
            headline: phrasing.headline,
            facts: phrasing.facts,
            evidenceDays: [],
            surprise,
            signature,
          })
        }
      }
    }
  }

  // 7. Streak Records (Habit streaks >= 7 days)
  for (const driver of binaryDrivers) {
    if (driver.kind === 'yesno') {
      let longest = 0
      let cur = 0
      for (const val of driver.values) {
        if (val) {
          cur++
          if (cur > longest) longest = cur
        } else {
          cur = 0
        }
      }

      if (longest >= 7) {
        const signature = `streak|${driver.key}|${longest}`
        if (!discardedSet.has(signature)) {
          const phrasing = composeStreakRecordPhrasing(driver.label, longest, false)
          const pVal = Math.max(0.001, 1.0 / (longest * 2.0))
          const surprise = Math.min(10.0, Math.max(2.0, (longest / 7.0) * 3.0))

          rawCandidates.push({
            test: {
              id: signature,
              testType: 'streak_record',
              driverKey: driver.key,
              driverLabel: driver.label,
              driverKind: 'yesno',
              outcomeKey: driver.key,
              outcomeLabel: driver.label,
              outcomeKind: 'scale',
              lag: 0,
            },
            n: driver.values.length,
            pValue: pVal,
            effectSize: longest,
            direction: 'positive',
            headline: phrasing.headline,
            facts: phrasing.facts,
            evidenceDays: [],
            surprise,
            signature,
          })
        }
      }
    }
  }

  // 8. "Best Days Had in Common" (Top quartile days on overallRating)
  const ratedDays = sortedDays.filter((d) => d.overallRating !== undefined && d.overallRating !== null)
  if (ratedDays.length >= 12) {
    const sortedByRating = [...ratedDays].sort((a, b) => (b.overallRating || 0) - (a.overallRating || 0))
    const topQuartileCount = Math.max(3, Math.floor(sortedByRating.length * 0.25))
    const topQuartileDates = new Set(sortedByRating.slice(0, topQuartileCount).map((d) => d.date))
    const restDates = new Set(sortedByRating.slice(topQuartileCount).map((d) => d.date))

    for (const driver of binaryDrivers) {
      let topCount = 0
      let restCount = 0

      for (let i = 0; i < dates.length; i++) {
        const d = dates[i]
        const val = driver.values[i]
        if (val) {
          if (topQuartileDates.has(d)) topCount++
          if (restDates.has(d)) restCount++
        }
      }

      const topPct = topCount / topQuartileDates.size
      const restPct = restCount / Math.max(1, restDates.size)

      if (topPct >= restPct + 0.25 && topCount >= 2) {
        const signature = `best_days|${driver.key}`
        if (!discardedSet.has(signature)) {
          const zTest = twoProportionZTest(topCount, topQuartileDates.size, restCount, restDates.size)
          if (zTest.z > 1.5) {
            const phrasing = composeBestDaysPhrasing(driver.label, topPct, restPct, topQuartileCount)
            const surprise = Math.min(10.0, Math.max(2.0, (topPct - restPct) * 10.0))

            rawCandidates.push({
              test: {
                id: signature,
                testType: 'best_days',
                driverKey: driver.key,
                driverLabel: driver.label,
                driverKind: driver.kind,
                outcomeKey: 'derived.overallRating',
                outcomeLabel: 'Overall Day Rating',
                outcomeKind: 'rating',
                lag: 0,
              },
              n: ratedDays.length,
              pValue: zTest.pValue,
              effectSize: topPct - restPct,
              direction: 'positive',
              headline: phrasing.headline,
              facts: phrasing.facts,
              evidenceDays: [],
              surprise,
              signature,
            })
          }
        }
      }
    }
  }

  // 7.5 Cycle-Phase Effects (when cycles are tracked)
  if (cycles.length > 0 && testsEvaluated < maxTests) {
    const activeCycles = [...cycles]
      .filter((c) => !c.deletedAt)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))

    const toUtcMs = (ymd: string) => new Date(ymd + 'T00:00:00Z').getTime()
    const dayDiff = (fromYmd: string, toYmd: string) =>
      Math.round((toUtcMs(toYmd) - toUtcMs(fromYmd)) / 86400000)

    const phaseDefs: Array<{ key: string; label: string }> = [
      { key: 'menstrual', label: 'Menstrual (Flow) days' },
      { key: 'luteal', label: 'Pre-period (5 days before)' },
      { key: 'follicular', label: 'Post-period week' },
    ]

    const getDatePhase = (dStr: string): string | null => {
      for (let idx = 0; idx < activeCycles.length; idx++) {
        const c = activeCycles[idx]
        const flowEndOffset = c.endDate ? Math.max(0, dayDiff(c.startDate, c.endDate)) : 4
        const sinceStart = dayDiff(c.startDate, dStr)
        if (sinceStart >= 0 && sinceStart <= flowEndOffset) {
          return 'menstrual'
        }
        if (sinceStart > flowEndOffset && sinceStart <= flowEndOffset + 7) {
          return 'follicular'
        }
        const daysUntilStart = dayDiff(dStr, c.startDate)
        if (daysUntilStart >= 1 && daysUntilStart <= 5) {
          return 'luteal'
        }
      }
      return null
    }

    for (const phase of phaseDefs) {
      if (testsEvaluated >= maxTests) {
        truncated = true
        break
      }
      for (const outcome of outcomes) {
        if (testsEvaluated >= maxTests) {
          truncated = true
          break
        }
        const phaseVals: number[] = []
        const otherVals: number[] = []
        const evidencePairs: EvidenceDay[] = []

        for (let i = 0; i < dates.length; i++) {
          const val = outcome.values[i]
          if (val === null) continue
          if (getDatePhase(dates[i]) === phase.key) {
            phaseVals.push(val)
            const curDay = dayByDate.get(dates[i])
            evidencePairs.push({
              date: dates[i],
              title: curDay?.title,
              oneliner: curDay?.oneliner,
              outcomeValue: val,
            })
          } else {
            otherVals.push(val)
          }
        }

        if (phaseVals.length >= 3 && otherVals.length >= 5) {
          testsEvaluated++
          const mwu = mannWhitneyU(phaseVals, otherVals)
          const diff = mwu.mean1 - mwu.mean0
          const dir = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'
          const signature = `cycle|${phase.key}|${outcome.key}|${dir}`
          if (discardedSet.has(signature)) continue

          const diffStr = formatValue(Math.abs(diff), outcome.unit)
          const mean1Str = formatValue(mwu.mean1, outcome.unit)
          const mean0Str = formatValue(mwu.mean0, outcome.unit)
          const dirWord = diff >= 0 ? 'higher' : 'lower'
          const headline = `${phase.label}: ${outcome.label} averages ${diffStr} ${dirWord}`
          const facts = [
            `During ${phase.label.toLowerCase()}, ${outcome.label} averaged ${mean1Str} across ${phaseVals.length} days versus ${mean0Str} across ${otherVals.length} other days.`,
            `Difference of ${diff >= 0 ? '+' : '-'}${diffStr} (${dir}).`,
          ]

          rawCandidates.push({
            test: {
              id: signature,
              testType: 'cycle_phase',
              driverKey: `cycle:${phase.key}`,
              driverLabel: phase.label,
              driverKind: 'cycle',
              outcomeKey: outcome.key,
              outcomeLabel: outcome.label,
              outcomeKind: outcome.kind,
              unit: outcome.unit,
              lag: 0,
            },
            n: phaseVals.length + otherVals.length,
            pValue: mwu.pValue,
            effectSize: mwu.cliffsDelta,
            direction: dir,
            headline,
            facts,
            evidenceDays: evidencePairs.slice(0, 5),
            surprise: Math.min(10.0, Math.max(1.0, Math.abs(mwu.cliffsDelta) * 10.0)),
            signature,
          })
        }
      }
    }
  }

  // 7.6 Compound 2-to-3-way Conjunction Rules (greedy synergy search)
  if (dates.length >= 12 && testsEvaluated < maxTests) {
    const candidateBinary = binaryDrivers
      .filter((d) => {
        const trueCount = d.values.filter((v) => v === true).length
        const falseCount = d.values.filter((v) => v === false).length
        return trueCount >= 4 && falseCount >= 5
      })
      .slice(0, 10)
    const primaryOutcomes = outcomes.slice(0, 4)

    for (const outcome of primaryOutcomes) {
      if (testsEvaluated >= maxTests) {
        truncated = true
        break
      }
      for (let i = 0; i < candidateBinary.length; i++) {
        for (let j = i + 1; j < candidateBinary.length; j++) {
          if (testsEvaluated >= maxTests) {
            truncated = true
            break
          }
          const dA = candidateBinary[i]
          const dB = candidateBinary[j]
          const g1: number[] = []
          const g0: number[] = []
          const evDays: EvidenceDay[] = []

          for (let k = 0; k < dates.length; k++) {
            const ov = outcome.detrendedValues[k]
            const rawOv = outcome.values[k]
            if (ov === null || rawOv === null) continue
            if (dA.values[k] === true && dB.values[k] === true) {
              g1.push(ov)
              const curDay = dayByDate.get(dates[k])
              evDays.push({
                date: dates[k],
                title: curDay?.title,
                oneliner: curDay?.oneliner,
                outcomeValue: rawOv,
              })
            } else if (dA.values[k] !== null && dB.values[k] !== null) {
              g0.push(ov)
            }
          }

          if (g1.length < 4 || g0.length < 5) continue
          testsEvaluated++
          const pairMwu = mannWhitneyU(g1, g0)
          if (pairMwu.pValue >= 0.05 || Math.abs(pairMwu.cliffsDelta) < 0.35) continue

          const pairDiff = pairMwu.mean1 - pairMwu.mean0
          const pairDir = pairDiff > 0 ? 'positive' : pairDiff < 0 ? 'negative' : 'neutral'
          const pairSig = `compound|${dA.key}+${dB.key}|${outcome.key}|${pairDir}`
          if (!discardedSet.has(pairSig)) {
            const diffStr = formatValue(Math.abs(pairDiff), outcome.unit)
            const m1Str = formatValue(pairMwu.mean1, outcome.unit)
            const m0Str = formatValue(pairMwu.mean0, outcome.unit)
            rawCandidates.push({
              test: {
                id: pairSig,
                testType: 'compound_rule',
                driverKey: `${dA.key}+${dB.key}`,
                driverLabel: `${dA.label} + ${dB.label}`,
                driverKind: 'derived',
                outcomeKey: outcome.key,
                outcomeLabel: outcome.label,
                outcomeKind: outcome.kind,
                unit: outcome.unit,
                lag: 0,
              },
              n: g1.length + g0.length,
              pValue: pairMwu.pValue,
              effectSize: pairMwu.cliffsDelta,
              direction: pairDir,
              headline: `When ${dA.label} and ${dB.label} happen together, ${outcome.label} shifts by ${pairDiff >= 0 ? '+' : '-'}${diffStr}`,
              facts: [
                `Combined (${g1.length} days): ${outcome.label} averaged ${m1Str} vs ${m0Str} across ${g0.length} other days.`,
              ],
              evidenceDays: evDays.slice(0, 5),
              surprise: Math.min(10.0, Math.max(1.5, Math.abs(pairMwu.cliffsDelta) * 10.0)),
              signature: pairSig,
            })
          }

          // Greedy 3-way extension
          for (let m = j + 1; m < candidateBinary.length; m++) {
            if (testsEvaluated >= maxTests) {
              truncated = true
              break
            }
            const dC = candidateBinary[m]
            const t1: number[] = []
            const t0: number[] = []
            const tEv: EvidenceDay[] = []
            for (let k = 0; k < dates.length; k++) {
              const ov = outcome.detrendedValues[k]
              const rawOv = outcome.values[k]
              if (ov === null || rawOv === null) continue
              if (dA.values[k] === true && dB.values[k] === true && dC.values[k] === true) {
                t1.push(ov)
                const curDay = dayByDate.get(dates[k])
                tEv.push({ date: dates[k], title: curDay?.title, oneliner: curDay?.oneliner, outcomeValue: rawOv })
              } else if (dA.values[k] !== null && dB.values[k] !== null && dC.values[k] !== null) {
                t0.push(ov)
              }
            }
            if (t1.length < 4 || t0.length < 5) continue
            testsEvaluated++
            const triMwu = mannWhitneyU(t1, t0)
            if (
              triMwu.pValue < pairMwu.pValue &&
              Math.abs(triMwu.cliffsDelta) >= Math.abs(pairMwu.cliffsDelta) + 0.05
            ) {
              const triDiff = triMwu.mean1 - triMwu.mean0
              const triDir = triDiff > 0 ? 'positive' : 'negative'
              const triSig = `compound|${dA.key}+${dB.key}+${dC.key}|${outcome.key}|${triDir}`
              if (!discardedSet.has(triSig)) {
                const diffStr = formatValue(Math.abs(triDiff), outcome.unit)
                rawCandidates.push({
                  test: {
                    id: triSig,
                    testType: 'compound_rule',
                    driverKey: `${dA.key}+${dB.key}+${dC.key}`,
                    driverLabel: `${dA.label} + ${dB.label} + ${dC.label}`,
                    driverKind: 'derived',
                    outcomeKey: outcome.key,
                    outcomeLabel: outcome.label,
                    outcomeKind: outcome.kind,
                    unit: outcome.unit,
                    lag: 0,
                  },
                  n: t1.length + t0.length,
                  pValue: triMwu.pValue,
                  effectSize: triMwu.cliffsDelta,
                  direction: triDir,
                  headline: `3-factor pattern: ${dA.label} + ${dB.label} + ${dC.label} shifts ${outcome.label} by ${triDiff >= 0 ? '+' : '-'}${diffStr}`,
                  facts: [
                    `All three combined (${t1.length} days): ${outcome.label} averaged ${formatValue(triMwu.mean1, outcome.unit)} vs ${formatValue(triMwu.mean0, outcome.unit)}.`,
                  ],
                  evidenceDays: tEv.slice(0, 5),
                  surprise: Math.min(10.0, Math.max(2.0, Math.abs(triMwu.cliffsDelta) * 10.0)),
                  signature: triSig,
                })
              }
            }
          }
        }
      }
    }
  }

  // Early baseline & observational padding if under minShow (e.g. tiny data 2 to 5 days)
  if (rawCandidates.length < minShow) {
    for (const m of dailyTable.metrics) {
      const vals = dates
        .map((d) => rowsByDate.get(d)?.values[m.key])
        .filter((v): v is number => v !== null && v !== undefined && !isNaN(v))

      if (vals.length > 0) {
        const avg = mean(vals)
        const signature = `early_baseline|${m.key}`
        if (!discardedSet.has(signature)) {
          rawCandidates.push({
            test: {
              id: signature,
              testType: 'numeric_outcome',
              driverKey: m.key,
              driverLabel: m.label,
              driverKind: m.partKind,
              outcomeKey: m.key,
              outcomeLabel: m.label,
              outcomeKind: 'scale',
              lag: 0,
            },
            n: vals.length,
            pValue: 1.0,
            effectSize: 0,
            direction: 'neutral',
            headline: `Early baseline for ${m.questionLabel} (${m.label})`,
            facts: [
              `Averaging ${avg.toFixed(1)}${m.unit ? ' ' + m.unit : ''} across your first ${vals.length} recorded day${vals.length === 1 ? '' : 's'}.`,
              'Initial baseline established while logging begins.',
            ],
            evidenceDays: [],
            surprise: 1.0,
            signature,
          })
        }
      }
      if (rawCandidates.length >= minShow) break
    }

    if (rawCandidates.length < minShow) {
      for (let i = 0; i < sortedDays.length && rawCandidates.length < minShow; i++) {
        const d = sortedDays[i]
        const signature = `early_day|${d.date}`
        if (!discardedSet.has(signature)) {
          rawCandidates.push({
            test: {
              id: signature,
              testType: 'numeric_outcome',
              driverKey: 'day',
              driverLabel: d.date,
              driverKind: 'derived',
              outcomeKey: 'derived.overallRating',
              outcomeLabel: 'Overall Day Rating',
              outcomeKind: 'rating',
              lag: 0,
            },
            n: 1,
            pValue: 1.0,
            effectSize: 0,
            direction: 'neutral',
            headline: `Day summary for ${d.date}`,
            facts: [
              `Recorded in ${d.mode} mode with rating ${d.overallRating || 'unrated'}.`,
              d.oneliner ? `"${d.oneliner}"` : 'Logged successfully.',
            ],
            evidenceDays: [{ date: d.date, title: d.title, oneliner: d.oneliner }],
            surprise: 1.0,
            signature,
          })
        }
      }
    }
  }

  // MULTIPLE TESTING CORRECTION (Benjamini-Hochberg) & SCORING
  const pValues = rawCandidates.map((c) => c.pValue)
  const qValues = benjaminiHochberg(pValues)

  const scoredCandidates: CandidateResult[] = rawCandidates.map((cand, idx) => {
    const qVal = qValues[idx]
    const n = cand.n

    // Sureness calculation per TRD Section 7 & Plan Phase 7:
    // Monotonically increases with sample size n; strictly < 1.0 for n < 8,
    // < 2.0 for tiny data (2..5 days), and > 6.0 for large n (>= 90) with strong significance.
    let sureness = 0

    if (n < 8) {
      sureness = Math.min(0.95, Math.max(0.1, (1.0 - qVal) * (n / 8.0) * 0.95))
    } else {
      const confidence = Math.max(0.0, 1.0 - qVal)
      const sampleScale = Math.min(1.0, Math.sqrt(n / 60.0))
      sureness = Math.min(10.0, Math.max(0.5, confidence * 10.0 * sampleScale))
    }

    const surprise = cand.surprise
    const score = Math.min(10.0, Math.max(0.0, Math.sqrt(sureness * surprise)))

    return {
      test: cand.test,
      n,
      pValue: cand.pValue,
      qValue: qVal,
      effectSize: cand.effectSize,
      direction: cand.direction,
      headline: cand.headline,
      facts: cand.facts,
      evidenceDays: cand.evidenceDays,
      sureness: Number(sureness.toFixed(1)),
      surprise: Number(surprise.toFixed(1)),
      score: Number(score.toFixed(1)),
      signature: cand.signature,
    }
  })

  // Deduplicate by signature
  const dedupedMap = new Map<string, CandidateResult>()
  for (const c of scoredCandidates) {
    if (!dedupedMap.has(c.signature) || c.score > dedupedMap.get(c.signature)!.score) {
      dedupedMap.set(c.signature, c)
    }
  }

  const allScored = Array.from(dedupedMap.values())
  // Sort descending by score
  allScored.sort((a, b) => b.score - a.score)

  const nGenerated = allScored.length
  const aboveBar = allScored.filter((c) => c.score >= bar)
  const nAboveBar = aboveBar.length

  // TRD 7: Display all with score >= bar (6.5), padded to minShow (20) by next best
  let selected = aboveBar
  if (selected.length < minShow) {
    const belowBar = allScored.filter((c) => c.score < bar)
    const needed = minShow - selected.length
    selected = [...selected, ...belowBar.slice(0, needed)]
  }

  return {
    windowStart,
    windowEnd,
    windowLabel,
    nGenerated,
    nAboveBar,
    bar,
    truncated,
    insights: selected,
  }
}
