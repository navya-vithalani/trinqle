import React from 'react'
import { TrendingUp, BarChart2 } from 'lucide-react'
import type { ScaleNumberStats, MetricDefinition } from '../../core/metrics/types'

interface ScaleMetricCardProps {
  metric: MetricDefinition
  stats: ScaleNumberStats
  onSelect?: () => void
}

export const ScaleMetricCard: React.FC<ScaleMetricCardProps> = ({
  metric,
  stats,
  onSelect,
}) => {
  const points = stats.points
  const validPoints = points.filter((p) => !p.isMissing)

  // Chart coordinate calculations
  const width = 320
  const height = 90
  const paddingX = 12
  const paddingY = 10

  const minVal = Math.min(stats.min, 0)
  const maxVal = Math.max(stats.max, 10)
  const valRange = maxVal - minVal || 1

  const getX = (idx: number, total: number) => {
    if (total <= 1) return width / 2
    return paddingX + (idx / (total - 1)) * (width - 2 * paddingX)
  }

  const getY = (val: number) => {
    const norm = (val - minVal) / valRange
    return height - paddingY - norm * (height - 2 * paddingY)
  }

  // Generate SVG path for primary trend line
  let linePath = ''
  let areaPath = ''
  let rollingPath = ''

  if (validPoints.length > 0) {
    validPoints.forEach((pt, i) => {
      const x = getX(i, validPoints.length)
      const y = getY(pt.value)
      if (i === 0) {
        linePath += `M ${x} ${y}`
        areaPath += `M ${x} ${height - paddingY} L ${x} ${y}`
      } else {
        linePath += ` L ${x} ${y}`
        areaPath += ` L ${x} ${y}`
      }

      if (i === validPoints.length - 1) {
        areaPath += ` L ${x} ${height - paddingY} Z`
      }
    })

    // Rolling average curve
    validPoints.forEach((pt, i) => {
      if (pt.rollingAvg !== undefined) {
        const x = getX(i, validPoints.length)
        const y = getY(pt.rollingAvg)
        if (i === 0) rollingPath += `M ${x} ${y}`
        else rollingPath += ` L ${x} ${y}`
      }
    })
  }

  const maxWeekdayAvg = Math.max(...stats.weekdayAverages.map((w) => w.avg), 1)

  return (
    <div
      onClick={onSelect}
      className="sticker-card p-4 space-y-3 cursor-pointer hover:border-[var(--color-accent)] transition-colors active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--color-ink-soft)]">
            {metric.questionLabel}
          </span>
          <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-1.5">
            <TrendingUp size={16} className="text-[var(--color-accent)] shrink-0" />
            {metric.label}
          </h3>
        </div>
        <div className="text-right">
          <div className="text-base font-extrabold text-[var(--color-accent)]">
            {stats.mean}
            {metric.unit ? <span className="text-xs font-normal ml-0.5">{metric.unit}</span> : ''}
          </div>
          <div className="text-[10px] text-[var(--color-ink-soft)]">Average</div>
        </div>
      </div>

      {/* Stats summary strip */}
      <div className="grid grid-cols-3 gap-2 py-1.5 px-3 rounded-xl bg-[var(--color-bg)] text-center text-xs">
        <div>
          <span className="text-[10px] text-[var(--color-ink-soft)] block">Min</span>
          <span className="font-bold text-[var(--color-ink)]">{stats.min}</span>
        </div>
        <div className="border-x border-[var(--color-line)]">
          <span className="text-[10px] text-[var(--color-ink-soft)] block">Latest</span>
          <span className="font-bold text-[var(--color-ink)]">{stats.latestValue ?? '-'}</span>
        </div>
        <div>
          <span className="text-[10px] text-[var(--color-ink-soft)] block">Max</span>
          <span className="font-bold text-[var(--color-ink)]">{stats.max}</span>
        </div>
      </div>

      {/* SVG Trend Line Chart */}
      {validPoints.length > 0 ? (
        <div className="relative bg-[var(--color-bg)] rounded-xl p-2 overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-24 overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`grad-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Guide Lines */}
            <line
              x1={paddingX}
              y1={paddingY}
              x2={width - paddingX}
              y2={paddingY}
              stroke="var(--color-line)"
              strokeDasharray="2 2"
              strokeWidth="0.75"
            />
            <line
              x1={paddingX}
              y1={height - paddingY}
              x2={width - paddingX}
              y2={height - paddingY}
              stroke="var(--color-line)"
              strokeWidth="1"
            />

            {/* Area Fill */}
            {areaPath && <path d={areaPath} fill={`url(#grad-${metric.key})`} />}

            {/* 7-day Rolling Average (Dashed) */}
            {rollingPath && (
              <path
                d={rollingPath}
                fill="none"
                stroke="var(--color-ink-soft)"
                strokeDasharray="3 3"
                strokeWidth="1.5"
                opacity="0.7"
              />
            )}

            {/* Main Trend Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Points */}
            {validPoints.map((pt, i) => (
              <circle
                key={i}
                cx={getX(i, validPoints.length)}
                cy={getY(pt.value)}
                r="3"
                className="fill-[var(--color-surface)] stroke-[var(--color-accent)] stroke-[2px]"
              />
            ))}
          </svg>

          <div className="flex items-center justify-between text-[10px] text-[var(--color-ink-soft)] px-1 pt-1">
            <span>{validPoints[0]?.date.slice(5)}</span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-0.5 bg-[var(--color-accent)] inline-block rounded-full" /> Trend
              <span className="w-2.5 h-0.5 border-t border-dashed border-[var(--color-ink-soft)] inline-block ml-1" /> 7d avg
            </span>
            <span>{validPoints[validPoints.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-[var(--color-ink-soft)]">
          No entries recorded for this time scope.
        </div>
      )}

      {/* Weekday distribution mini bars */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] text-[var(--color-ink-soft)]">
          <span className="flex items-center gap-1 font-semibold">
            <BarChart2 size={11} /> Weekday average
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {stats.weekdayAverages.map((w) => {
            const heightPct = maxWeekdayAvg > 0 ? Math.max(15, (w.avg / maxWeekdayAvg) * 100) : 15
            return (
              <div key={w.weekday} className="flex flex-col items-center gap-1">
                <div className="h-10 w-full bg-[var(--color-bg)] rounded-md flex items-end p-0.5">
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full rounded-sm bg-[var(--color-accent)]/70 transition-all"
                    title={`${w.dayName}: avg ${w.avg} (${w.count} entries)`}
                  />
                </div>
                <span className="text-[9px] text-[var(--color-ink-soft)] font-medium">
                  {w.dayName[0]}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
