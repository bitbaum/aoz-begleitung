import Link from 'next/link'
import { BarChart } from '@bitbaum/chartkit/react'
import {
  SATISFACTION_EMOJIS,
  SATISFACTION_LABELS,
  SATISFACTION_CHART_LABELS,
} from '@/lib/constants'

interface Props {
  days: number
  totalCheckIns: number
  avgSatisfaction: string | null
  satisfactionCounts: number[]
  lowSatisfactionCount: number
}

export function SatisfactionChart({
  days,
  totalCheckIns,
  avgSatisfaction,
  satisfactionCounts,
  lowSatisfactionCount,
}: Props) {
  // The face for the average, taken from the same scale everyone else renders.
  // This was a three-branch ternary spelling out its own faces, in a file that
  // already imported the scale — so the dashboard could disagree with the form
  // that produced the numbers it was summarising.
  const average = avgSatisfaction === null ? null : Number.parseFloat(avgSatisfaction)
  const averageFace =
    average === null || Number.isNaN(average)
      ? null
      : SATISFACTION_EMOJIS[
          Math.min(SATISFACTION_EMOJIS.length, Math.max(1, Math.round(average))) - 1
        ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ui-text">Zufriedenheit ({days} Tage)</h2>
        <Link
          href="/placements"
          className="inline-flex items-center min-h-[44px] px-1 text-sm text-brand-primary hover:underline"
        >
          Alle Check-ins
        </Link>
      </div>
      {totalCheckIns === 0 ? (
        <p className="text-ui-muted text-center py-8">Keine Check-ins in diesem Zeitraum</p>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-6 p-4 bg-ui-subtle rounded-lg">
            <div className="text-4xl" aria-hidden="true">
              {averageFace}
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-ui-text">{avgSatisfaction}/5</p>
              <p className="text-sm text-ui-muted">Ø aus {totalCheckIns} Check-ins</p>
            </div>
            {lowSatisfactionCount > 0 && (
              <div className="ml-auto text-right">
                <p className="text-status-warning-text font-semibold">{lowSatisfactionCount}</p>
                <p className="text-sm text-ui-muted">mit Bedenken</p>
              </div>
            )}
          </div>
          <BarChart
            rows={satisfactionCounts.map((count, index) => ({
              label: `${index + 1}/5 ${SATISFACTION_LABELS[index]}`,
              value: count,
              share: count / totalCheckIns,
              tone: index >= 3 ? 'positive' : index === 2 ? 'warning' : 'negative',
            }))}
            max={totalCheckIns}
            order="input"
            locale="de-CH"
            labels={SATISFACTION_CHART_LABELS.table}
            caption={SATISFACTION_CHART_LABELS.caption}
          />
        </>
      )}
    </div>
  )
}
