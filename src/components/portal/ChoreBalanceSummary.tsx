'use client'

import { CHORE_LABELS } from '@/lib/config/household-tasks'
import { residentName } from '@/lib/utils/resident-name'

/**
 * Replaces the old completion-count leaderboard.
 *
 * Two deliberate differences from a ranking. First, the rows stay in household
 * order and carry no position, medal or colour-by-rank — the panel answers "are
 * we roughly even?", never "who is winning?". Second, the explainer names the
 * memory bias as something that affects everyone, so a resident reading a
 * negative balance meets a correction rather than an accusation. A number that
 * arrives as an accusation gets argued with; one that arrives as a correction
 * gets acted on.
 *
 * Colour is rationed to the sign of the balance and nothing else.
 */

export interface ChoreBalanceRow {
  residentId: string
  code: string
  displayName: string | null
  doneMinutes: number
  shareMinutes: number
  balanceMinutes: number
}

interface ChoreBalanceSummaryProps {
  balances: ChoreBalanceRow[]
  /** Whose portal this is — the only row we mark, so people find themselves. */
  currentResidentId?: string
}

export function ChoreBalanceSummary({ balances, currentResidentId }: ChoreBalanceSummaryProps) {
  const totalMinutes = balances.reduce((sum, b) => sum + b.doneMinutes, 0)

  // Bars are scaled to the largest imbalance so a near-even month reads as
  // near-even. Scaling to the largest CONTRIBUTION instead would always paint
  // one person's bar full and imply a winner.
  const widest = Math.max(...balances.map((b) => Math.abs(b.balanceMinutes)), 1)

  return (
    <div className="card">
      <div className="mb-1">
        <h3 className="font-semibold text-ui-text">{CHORE_LABELS.balance.title}</h3>
        <p className="eyebrow mt-0.5">{CHORE_LABELS.balance.subtitle}</p>
      </div>

      <p className="text-xs text-ui-muted mt-3 mb-4">{CHORE_LABELS.balance.explainer}</p>

      {totalMinutes === 0 ? (
        <p className="text-sm text-ui-muted">{CHORE_LABELS.balance.empty}</p>
      ) : (
        <>
          <div className="space-y-4">
            {balances.map((entry) => {
              const rounded = Math.round(entry.balanceMinutes)
              const ahead = rounded > 0
              const even = rounded === 0
              const width = Math.round((Math.abs(entry.balanceMinutes) / widest) * 50)

              return (
                <div key={entry.residentId}>
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-sm font-medium text-ui-text truncate">
                      {residentName(entry)}
                      {entry.residentId === currentResidentId && (
                        <span className="eyebrow ms-2">Sie</span>
                      )}
                    </span>
                    <span
                      className={`numeric text-sm shrink-0 ${
                        even
                          ? 'text-ui-muted'
                          : ahead
                            ? 'text-status-success-text'
                            : 'text-status-warning-text'
                      }`}
                    >
                      {ahead ? '+' : ''}
                      {rounded} {CHORE_LABELS.balance.minutes}
                    </span>
                  </div>

                  {/* Diverging bar: centre line = exactly your share. */}
                  <div className="meter-lg" aria-hidden="true">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-ui-border-strong" />
                    <div
                      className={`absolute inset-y-0 ${ahead ? 'left-1/2' : 'right-1/2'} ${
                        even ? '' : ahead ? 'bg-status-success' : 'bg-status-warning'
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>

                  <p className="text-xs text-ui-muted mt-1 numeric">
                    {CHORE_LABELS.balance.done} {Math.round(entry.doneMinutes)} ·{' '}
                    {CHORE_LABELS.balance.share} {Math.round(entry.shareMinutes)}{' '}
                    {CHORE_LABELS.balance.minutes}
                  </p>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-ui-muted mt-5 pt-4 border-t border-ui-border">
            {CHORE_LABELS.balance.netHint} {CHORE_LABELS.balance.settleHint}
          </p>
        </>
      )}
    </div>
  )
}
