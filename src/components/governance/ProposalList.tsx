'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateNumeric } from '@/lib/utils/formatting'
import type {
  DecisionMode,
  ProposalStatus,
  ProposalType,
  RuleCategory,
  VoteChoice,
  VoteThreshold,
} from '@/lib/db'
import {
  DECISION_MODE_IS_VOTED,
  DECISION_MODE_LABELS,
  PROPOSAL_STATUS_COLORS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_TYPE_LABELS,
  THRESHOLD_DESCRIPTIONS,
  THRESHOLD_LABELS,
  VOTE_CHOICE_COLORS,
  VOTE_CHOICE_DESCRIPTIONS,
  VOTE_CHOICE_LABELS,
} from '@/lib/config/decisions'
import { RULE_CATEGORY_LABELS } from '@/lib/config/house-rules'
import { BRAND } from '@/lib/config/brand'

interface Tally {
  yes: number
  no: number
  abstain: number
  blocks: number
  castVotes: number
  eligibleVoterCount: number
  explanation: string
}

export interface ProposalView {
  id: string
  title: string
  body: string
  type: ProposalType
  category: RuleCategory
  status: ProposalStatus
  decisionMode: DecisionMode
  threshold: VoteThreshold
  votingEndsAt: string | null
  discussionEndsAt: string | null
  outcomeSummary: string | null
  staffNotes: string | null
  parentRuleTitle: string | null
  isMine: boolean
  myVote: VoteChoice | null
  tally: Tally
}

const VOTE_ORDER: VoteChoice[] = ['YES', 'NO', 'ABSTAIN', 'BLOCK']

export function ProposalList({ proposals }: { proposals: ProposalView[] }) {
  if (proposals.length === 0) {
    return (
      <p className="rounded-md bg-ui-subtle p-4 text-sm text-ui-muted">
        Zurzeit steht nichts zur Abstimmung. Du kannst jederzeit selbst etwas vorschlagen.
      </p>
    )
  }

  return (
    <ul className="space-y-4">
      {proposals.map((proposal) => (
        <li key={proposal.id}>
          <ProposalCard proposal={proposal} />
        </li>
      ))}
    </ul>
  )
}

function ProposalCard({ proposal }: { proposal: ProposalView }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showVetoReason, setShowVetoReason] = useState(false)

  const isVoting = proposal.status === 'VOTING'

  function castVote(choice: VoteChoice) {
    // A veto has to say why — an unexplained one cannot be mediated, only resented.
    if (choice === 'BLOCK' && reason.trim().length < 5) {
      setShowVetoReason(true)
      setError('Bitte schreib in einem Satz, warum du damit nicht leben kannst.')
      return
    }

    setError(null)
    startTransition(async () => {
      const response = await fetch('/api/portal/proposals/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: proposal.id,
          choice,
          reason: choice === 'BLOCK' ? reason : undefined,
        }),
      })
      const result = await response.json()
      if (result.success) {
        setShowVetoReason(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Stimme konnte nicht gespeichert werden')
      }
    })
  }

  return (
    <article className="card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-normal text-ui-muted">
            {PROPOSAL_TYPE_LABELS[proposal.type]} · {RULE_CATEGORY_LABELS[proposal.category]}
          </p>
          <h2 className="mt-1 font-semibold text-ui-text">{proposal.title}</h2>
        </div>
        <span className={`badge shrink-0 ${PROPOSAL_STATUS_COLORS[proposal.status]}`}>
          {PROPOSAL_STATUS_LABELS[proposal.status]}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ui-muted">{proposal.body}</p>

      {proposal.parentRuleTitle && (
        <p className="mt-3 text-sm text-ui-muted">
          Zum {BRAND.orgName}-Thema:{' '}
          <span className="font-medium text-ui-text">{proposal.parentRuleTitle}</span>
        </p>
      )}

      <p className="mt-3 text-sm text-ui-muted">
        {DECISION_MODE_LABELS[proposal.decisionMode]}
        {DECISION_MODE_IS_VOTED[proposal.decisionMode] && (
          <>
            {' · '}
            {THRESHOLD_LABELS[proposal.threshold]}
            <span className="block text-xs">{THRESHOLD_DESCRIPTIONS[proposal.threshold]}</span>
          </>
        )}
      </p>

      {proposal.status === 'DISCUSSION' && proposal.discussionEndsAt && (
        <p className="mt-3 rounded-md bg-status-info/10 p-3 text-sm text-status-info-text">
          Noch in der Diskussion. Die Abstimmung startet am{' '}
          {formatDateNumeric(proposal.discussionEndsAt)}.
        </p>
      )}

      {isVoting && (
        <div className="mt-4 border-t border-ui-border pt-4">
          <p className="text-sm text-ui-muted">
            Abstimmung läuft
            {proposal.votingEndsAt ? ` bis ${formatDateNumeric(proposal.votingEndsAt)}` : ''} ·{' '}
            {proposal.tally.castVotes} von {proposal.tally.eligibleVoterCount} haben abgestimmt
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {VOTE_ORDER.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => castVote(choice)}
                disabled={isPending}
                aria-pressed={proposal.myVote === choice}
                title={VOTE_CHOICE_DESCRIPTIONS[choice]}
                className={`min-h-[44px] rounded-md border px-4 text-sm font-medium transition ${
                  proposal.myVote === choice
                    ? `border-transparent ${VOTE_CHOICE_COLORS[choice]}`
                    : 'border-ui-border text-ui-text hover:border-brand-primary'
                }`}
              >
                {VOTE_CHOICE_LABELS[choice]}
              </button>
            ))}
          </div>

          {(showVetoReason || proposal.myVote === 'BLOCK') && (
            <div className="mt-3">
              <label htmlFor={`veto-${proposal.id}`} className="label">
                Warum kannst du damit nicht leben?
              </label>
              <textarea
                id={`veto-${proposal.id}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                className="input w-full"
              />
              <p className="mt-1 text-xs text-ui-muted">{VOTE_CHOICE_DESCRIPTIONS.BLOCK}</p>
            </div>
          )}

          {proposal.myVote && (
            <p className="mt-3 text-sm text-ui-muted">
              Deine Stimme: <strong>{VOTE_CHOICE_LABELS[proposal.myVote]}</strong>. Du kannst sie
              ändern, solange die Abstimmung läuft.
            </p>
          )}
        </div>
      )}

      {/* The same sentence staff see — nobody gets a different account of the result. */}
      {proposal.outcomeSummary && (
        <p className="mt-4 rounded-md bg-ui-subtle p-3 text-sm text-ui-text">
          {proposal.outcomeSummary}
        </p>
      )}

      {proposal.staffNotes && (
        <p className="mt-2 rounded-md border border-ui-border p-3 text-sm text-ui-muted">
          <span className="font-medium text-ui-text">Antwort der Betreuung: </span>
          {proposal.staffNotes}
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-status-error-text" role="alert">
          {error}
        </p>
      )}
    </article>
  )
}
