'use client'

/**
 * The filter bar on the Klient*innen list.
 *
 * Renders whatever `config/client-filters.ts` declares — the page turns each
 * declaration into a serialisable `FilterControl`, so this component never
 * imports the config (which holds SQL) and never knows which filters exist.
 *
 * State lives in the URL: every change navigates, so a filtered list is a
 * link that can be shared. A plain GET form underneath keeps it working
 * without JavaScript.
 *
 * Mobile-first: below `sm` the controls sit behind one "Filter (n)" button.
 */

import { useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { CLIENT_FILTER_LABELS as L } from '@/lib/constants/labels/residents'
import { RESIDENT_LIST_LABELS } from '@/lib/constants/labels/ui'

export interface FilterControl {
  id: string
  param: string
  label: string
  kind: 'select' | 'multiselect' | 'toggle'
  options: { value: string; label: string }[]
  /** Encoded current value: a string, a list (multiselect) or null. */
  value: string | string[] | null
  /** The value meaning "no restriction", if the filter spells one out. */
  neutral: string | null
}

export interface ClientFilterBarProps {
  action: string
  controls: FilterControl[]
  /** Params the bar does not own but must carry (search, layout, status tab). */
  carry: Record<string, string>
  activeCount: number
  resetHref: string
  /** Rendered at the end of the panel — the "Als Gruppe speichern" control. */
  children?: ReactNode
}

type ChangeHandler = (event: { currentTarget: { form: HTMLFormElement | null } }) => void

function MultiSelect({ control, onChange }: { control: FilterControl; onChange: ChangeHandler }) {
  const selected = new Set(Array.isArray(control.value) ? control.value : [])
  return (
    <details className="group relative w-full sm:w-auto">
      <summary className="input flex cursor-pointer list-none items-center justify-between gap-2 sm:min-w-[10rem] [&::-webkit-details-marker]:hidden">
        <span className="truncate">
          {control.label}
          {selected.size > 0 && <span className="numeric"> ({selected.size})</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <fieldset className="overlay-panel mt-1 w-full p-1 sm:absolute sm:z-30 sm:w-56">
        <legend className="sr-only">{control.label}</legend>
        {control.options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-ui-text hover:bg-ui-subtle"
          >
            <input
              type="checkbox"
              name={control.param}
              value={option.value}
              defaultChecked={selected.has(option.value)}
              onChange={onChange}
              className="h-4 w-4"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
    </details>
  )
}

export function ClientFilterBar({
  action,
  controls,
  carry,
  activeCount,
  resetHref,
  children,
}: ClientFilterBarProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // Build a clean URL (no empty params, multiselects as one comma list) and
  // navigate. The group param is not carried: changing a filter leaves the group.
  function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(carry)) if (value) params.set(key, value)
    for (const control of controls) {
      const values = data
        .getAll(control.param)
        .filter((v): v is string => typeof v === 'string' && v !== '')
      if (values.length > 0) params.set(control.param, values.join(','))
    }
    const query = params.toString()
    router.push(query ? `${action}?${query}` : action)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submit(event.currentTarget)
  }

  const onChange: ChangeHandler = (event) => {
    if (event.currentTarget.form) submit(event.currentTarget.form)
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-outline w-full sm:hidden"
        aria-expanded={open}
        aria-controls="client-filter-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {L.toggle(activeCount)}
      </button>

      <div
        id="client-filter-panel"
        className={`${open ? 'flex' : 'hidden'} flex-col gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-start`}
      >
        <form
          // Uncontrolled controls read `defaultValue` once; remount when the
          // URL state changes (reset link, group chip) so they never go stale.
          key={JSON.stringify(controls.map((c) => c.value))}
          method="GET"
          action={action}
          onSubmit={onSubmit}
          aria-label={L.barLabel}
          className="contents"
        >
          {Object.entries(carry).map(([key, value]) =>
            value ? <input key={key} type="hidden" name={key} value={value} /> : null,
          )}

          {controls.map((control) => {
            if (control.kind === 'multiselect') {
              return <MultiSelect key={control.id} control={control} onChange={onChange} />
            }
            if (control.kind === 'toggle') {
              return (
                <label
                  key={control.id}
                  className="input flex w-full cursor-pointer items-center gap-3 sm:w-auto"
                >
                  <input
                    type="checkbox"
                    name={control.param}
                    value="1"
                    defaultChecked={control.value === '1'}
                    onChange={onChange}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{control.options[0]?.label ?? control.label}</span>
                </label>
              )
            }
            return (
              <label key={control.id} className="block w-full sm:w-auto">
                <span className="sr-only">{control.label}</span>
                <select
                  name={control.param}
                  defaultValue={typeof control.value === 'string' ? control.value : ''}
                  onChange={onChange}
                  className="input sm:w-auto sm:min-w-[10rem]"
                >
                  <option value={control.neutral ?? ''}>
                    {control.label}: {L.any}
                  </option>
                  {control.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}

          <noscript>
            <button type="submit" className="btn-outline w-full sm:w-auto">
              {L.apply}
            </button>
          </noscript>
        </form>
        {activeCount > 0 && (
          <Link href={resetHref} className="btn-ghost w-full sm:w-auto">
            {RESIDENT_LIST_LABELS.filterReset}
          </Link>
        )}
        {children}
      </div>
    </div>
  )
}
