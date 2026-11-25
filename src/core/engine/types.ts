import type { PartKind } from '../../data/types'

export type CandidateTestType =
  | 'binary_outcome' // Mann-Whitney U test (binary driver vs numeric outcome)
  | 'numeric_outcome' // Spearman rank correlation (numeric driver vs numeric outcome)
  | 'weekday_effect' // Day of week vs outcome
  | 'cycle_phase' // Menstrual cycle phase vs outcome
  | 'compound_rule' // 2-to-3-way conjunction driver vs outcome
  | 'library_lag' // Item A at day d and Item B at day d+k
  | 'anomaly_outlier' // Robust z single day outlier
  | 'anomaly_stretch' // Consecutive rough or best stretch
  | 'changepoint' // Step shift in mean / CUSUM
  | 'streak_record' // Longest active or all-time streak
  | 'best_days' // Top-quartile days vs rest

export interface CandidateTest {
  id: string
  testType: CandidateTestType
  driverKey: string
  driverLabel: string
  driverKind: PartKind | 'derived' | 'item' | 'weekday' | 'cycle'
  outcomeKey: string
  outcomeLabel: string
  outcomeKind: 'scale' | 'number' | 'timerange' | 'rating' | 'memorability'
  unit?: string
  lag: number // 0..3
  metadata?: Record<string, unknown>
}

export interface EvidenceDay {
  date: string
  title?: string
  oneliner?: string
  driverValue?: number | string | boolean
  outcomeValue?: number
}

export interface CandidateResult {
  test: CandidateTest
  n: number
  pValue: number
  qValue: number // FDR corrected
  effectSize: number // Cliff's delta or Spearman rho or step difference
  direction: 'positive' | 'negative' | 'neutral'
  headline: string
  facts: string[]
  evidenceDays: EvidenceDay[]
  sureness: number // 0..10
  surprise: number // 0..10
  score: number // sqrt(sureness * surprise)
  signature: string
}

export interface EngineOptions {
  bar?: number // default 6.5
  minShow?: number // default 20
  minN?: number // default 5
  maxTests?: number // default 50000
  windowLabel?: string
  discardedSignatures?: string[]
  knownSignatures?: string[]
}

export interface EngineRunOutput {
  windowStart: string
  windowEnd: string
  windowLabel: string
  nGenerated: number
  nAboveBar: number
  bar: number
  truncated?: boolean
  insights: CandidateResult[]
}
