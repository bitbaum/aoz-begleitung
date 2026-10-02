'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RuleCategory, RuleDelegation, ProposalType } from '@/lib/db'
import { RULE_CATEGORY_LABELS } from '@/lib/config/house-rules'
import {
  CATEGORY_DECISION_MODE,
  DECISION_MODE_DESCRIPTIONS,
  PROPOSAL_TYPE_LABELS,
} from '@/lib/config/decisions'

interface OpenTopic {
  id: string
  title: string
  category: RuleCategory
  delegation: RuleDelegation
}

interface HouseRuleOption {
  id: string
  title: string
  category: RuleCategory
}

/**
 * Propose something to the house.
 *
 * The form is built from the topics this house may actually decide, rather than
 * offering a free-text field and rejecting the result afterwards. Choosing the
 * topic first also answers the question residents ask before anything else —
 * "what can we even change here?" — which a flat list of rules cannot.
 */
export function NewProposalForm({
  openTopics,
  existingHouseRules,
}: {
  openTopics: OpenTopic[]
  existingHouseRules: HouseRuleOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<ProposalType>('ADD_RULE')
  const [parentOrgRuleId, setParentOrgRuleId] = useState('')
  const [targetRuleId, setTargetRuleId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedTopic = openTopics.find((t) => t.id === parentOrgRuleId)
  const selectedRule = existingHouseRules.find((r) => r.id === targetRuleId)
  const category: RuleCategory =
    type === 'ADD_RULE' ? (selectedTopic?.category ?? 'OTHER') : (selectedRule?.category ?? 'OTHER')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const response = await fetch('/api/portal/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title,
          body,
          category,
          parentOrgRuleId: type === 'ADD_RULE' ? parentOrgRuleId : undefined,
          targetRuleId: type === 'ADD_RULE' ? undefined : targetRuleId || undefined,
        }),
      })
      const result = await response.json()

      if (result.success) {
        setTitle('')
        setBody('')
        setIsOpen(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Vorschlag konnte nicht erstellt werden')
      }
    })
  }

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className="btn-primary min-h-[44px]">
        Etwas vorschlagen
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="font-semibold text-ui-text">Vorschlag ans Haus</h2>

      <div>
        <label htmlFor="proposal-type" className="label">
          Was möchten Sie vorschlagen?
        </label>
        <select
          id="proposal-type"
          value={type}
          onChange={(event) => setType(event.target.value as ProposalType)}
          className="input w-full"
        >
          {(['ADD_RULE', 'AMEND_RULE', 'REPEAL_RULE', 'HOUSE_DECISION'] as const).map((option) => (
            <option key={option} value={option}>
              {PROPOSAL_TYPE_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      {type === 'ADD_RULE' && (
        <div>
          <label htmlFor="proposal-topic" className="label">
            Zu welchem Thema?
          </label>
          <select
            id="proposal-topic"
            value={parentOrgRuleId}
            onChange={(event) => setParentOrgRuleId(event.target.value)}
            required
            className="input w-full"
          >
            <option value="">Bitte wählen…</option>
            {openTopics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {RULE_CATEGORY_LABELS[topic.category]} — {topic.title}
              </option>
            ))}
          </select>
          {openTopics.length === 0 && (
            <p className="mt-1 text-sm text-ui-muted">
              Zu allen offenen Themen gibt es bereits eine Hausregel. Sie können eine bestehende
              Hausregel ändern.
            </p>
          )}
        </div>
      )}

      {(type === 'AMEND_RULE' || type === 'REPEAL_RULE') && (
        <div>
          <label htmlFor="proposal-target" className="label">
            Welche Hausregel?
          </label>
          <select
            id="proposal-target"
            value={targetRuleId}
            onChange={(event) => setTargetRuleId(event.target.value)}
            required
            className="input w-full"
          >
            <option value="">Bitte wählen…</option>
            {existingHouseRules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tell people up front who decides this. Discovering after a week of
          voting that the topic was never votable destroys participation. */}
      <p className="rounded-md bg-ui-subtle p-3 text-sm text-ui-muted">
        {DECISION_MODE_DESCRIPTIONS[CATEGORY_DECISION_MODE[category]]}
      </p>

      <div>
        <label htmlFor="proposal-title" className="label">
          Titel
        </label>
        <input
          id="proposal-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={3}
          maxLength={120}
          className="input w-full"
          placeholder="z.B. Putzplan für die Küche"
        />
      </div>

      <div>
        <label htmlFor="proposal-body" className="label">
          Ihr Vorschlag
        </label>
        <textarea
          id="proposal-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          className="input w-full"
          placeholder="Beschreiben Sie möglichst konkret, was gelten soll — wer macht was, ab wann?"
        />
      </div>

      {error && (
        <p className="text-sm text-status-error-text" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isPending} className="btn-primary min-h-[44px]">
          {isPending ? 'Wird eingereicht…' : 'Vorschlag einreichen'}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="btn-secondary min-h-[44px]"
        >
          Abbrechen
        </button>
      </div>
    </form>
  )
}
