'use client'

/**
 * Staff forms for anonymous surveys: create a draft, send it to an audience,
 * close it. Every action RETURNS its refusal (`SurveyFormState`), so a
 * rejected submit keeps the form and says what to change.
 */

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { closeSurvey, createSurvey, sendSurvey, type SurveyFormState } from '@/lib/actions/surveys'
import { SURVEY_LABELS as L } from '@/lib/constants/labels/surveys'

function FormError({ error }: { error?: string }) {
  if (!error) return null
  return (
    <p role="alert" className="alert-error text-sm">
      {error}
    </p>
  )
}

export interface TemplateChoice {
  id: string
  title: string
  intro: string
  questionCount: number
}

export function NewSurveyForm({
  templates,
  minResponses,
}: {
  templates: TemplateChoice[]
  minResponses: { default: number; min: number; max: number }
}) {
  const router = useRouter()
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const template = templates.find((entry) => entry.id === templateId) ?? templates[0]
  const [title, setTitle] = useState(template?.title ?? '')
  const [intro, setIntro] = useState(template?.intro ?? '')
  const [state, formAction, pending] = useActionState<SurveyFormState, FormData>(createSurvey, {})

  useEffect(() => {
    if (state.ok && state.surveyId) router.push(`/surveys/${state.surveyId}`)
  }, [state, router])

  return (
    <form action={formAction} className="card space-y-4">
      <label className="block">
        <span className="label">{L.template}</span>
        <select
          name="templateId"
          className="input"
          value={templateId}
          onChange={(event) => {
            const next = templates.find((entry) => entry.id === event.target.value)
            setTemplateId(event.target.value)
            if (next) {
              setTitle(next.title)
              setIntro(next.intro)
            }
          }}
        >
          {templates.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.title} · {L.templateQuestions(entry.questionCount)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">{L.title}</span>
        <input
          name="title"
          required
          maxLength={120}
          className="input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="block">
        <span className="label">{L.intro}</span>
        <textarea
          name="intro"
          maxLength={1000}
          className="input min-h-[96px]"
          value={intro}
          onChange={(event) => setIntro(event.target.value)}
        />
      </label>
      <label className="block">
        <span className="label">{L.minResponses}</span>
        <input
          name="minResponses"
          type="number"
          inputMode="numeric"
          min={minResponses.min}
          max={minResponses.max}
          defaultValue={minResponses.default}
          className="input numeric sm:max-w-[8rem]"
        />
        <span className="mt-1 block text-xs text-ui-muted">
          {L.minResponsesHint(minResponses.min, minResponses.max)}
        </span>
      </label>
      <FormError error={state.error} />
      <button type="submit" className="btn-secondary w-full sm:w-auto" disabled={pending}>
        {L.create}
      </button>
    </form>
  )
}

export interface AudienceGroup {
  id: string
  name: string
  memberCount: number | null
}

export interface AudienceClient {
  id: string
  name: string
}

export function SendSurveyForm({
  surveyId,
  isDraft,
  groups,
  clients,
}: {
  surveyId: string
  isDraft: boolean
  groups: AudienceGroup[]
  clients: AudienceClient[]
}) {
  const router = useRouter()
  const [kind, setKind] = useState<'group' | 'individuals'>(
    groups.length > 0 ? 'group' : 'individuals',
  )
  const [groupId, setGroupId] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [state, formAction, pending] = useActionState<SurveyFormState, FormData>(sendSurvey, {})

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  const visibleClients = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? clients.filter((client) => client.name.toLowerCase().includes(needle)) : clients
  }, [clients, query])

  const toggle = (id: string) =>
    setPicked((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={(event) => {
        if (isDraft && !window.confirm(L.openConfirm)) event.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={surveyId} />
      <input type="hidden" name="audience" value={kind} />

      <div
        role="radiogroup"
        aria-label={L.audienceTitle}
        className="flex flex-col gap-2 sm:flex-row"
      >
        {(['group', 'individuals'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            onClick={() => setKind(option)}
            className={kind === option ? 'btn-primary' : 'btn-outline'}
          >
            {option === 'group' ? L.audienceGroup : L.audienceIndividuals}
          </button>
        ))}
      </div>

      {kind === 'group' ? (
        groups.length === 0 ? (
          <p className="text-sm text-ui-muted">{L.noGroups}</p>
        ) : (
          <label className="block">
            <span className="label">{L.chooseGroup}</span>
            <select
              name="groupId"
              className="input"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              required
            >
              <option value="" disabled>
                {L.chooseGroup}
              </option>
              {groups.map((group) => (
                <option key={group.id} value={group.id} disabled={group.memberCount === null}>
                  {group.name} · {L.groupCount(group.memberCount)}
                </option>
              ))}
            </select>
          </label>
        )
      ) : (
        <div className="space-y-2">
          <label className="block">
            <span className="label">{L.chooseIndividuals}</span>
            <input
              type="search"
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
          </label>
          <p className="numeric text-xs text-ui-muted">{L.selectedCount(picked.size)}</p>
          {/* Every picked id is submitted even when the search hides it. */}
          {Array.from(picked).map((id) => (
            <input key={id} type="hidden" name="residentIds" value={id} />
          ))}
          <ul className="max-h-80 overflow-y-auto rounded-lg border border-ui-border">
            {visibleClients.map((client) => (
              <li key={client.id} className="border-b border-ui-border last:border-b-0">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={picked.has(client.id)}
                    onChange={() => toggle(client.id)}
                  />
                  <span className="text-sm text-ui-text">{client.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.ok && typeof state.invited === 'number' && (
        <p role="status" className="alert-success text-sm">
          {L.invitedNow(state.invited)}
        </p>
      )}
      <FormError error={state.error} />
      <button type="submit" className="btn-secondary w-full sm:w-auto" disabled={pending}>
        {isDraft ? L.open : L.inviteMore}
      </button>
    </form>
  )
}

export function CloseSurveyForm({ surveyId }: { surveyId: string }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<SurveyFormState, FormData>(closeSurvey, {})

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(event) => {
        if (!window.confirm(L.closeConfirm)) event.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={surveyId} />
      <FormError error={state.error} />
      <button type="submit" className="btn-outline w-full sm:w-auto" disabled={pending}>
        {L.close}
      </button>
    </form>
  )
}
