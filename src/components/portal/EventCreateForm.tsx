'use client'

import { DateInput } from '@/components/ui/DateInput'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useT, useLocale } from '@/lib/i18n/LocaleProvider'
import { HOUSE_EVENT_CATEGORY_LABEL_KEYS, HOUSE_EVENT_CATEGORIES } from '@/lib/config/events'

/**
 * "Neue Veranstaltung", collapsed until asked for.
 *
 * It used to sit permanently open at the top of the page, so the first thing a
 * resident saw was a blank form and the second was whether anything was
 * happening. The reason to open this page is the second one.
 */
export function EventCreateForm({ action }: { action: (formData: FormData) => void }) {
  const t = useT()
  const locale = useLocale()
  const [open, setOpen] = useState(false)

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 text-start"
      >
        <span className="text-lg font-semibold text-ui-text">{t('events.createNew')}</span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-ui-muted transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <form action={action} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="ev-title" className="label">
              {t('events.formTitle')}
            </label>
            <input id="ev-title" name="title" required maxLength={120} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ev-description" className="label">
              {t('events.formDescription')}
            </label>
            <textarea
              id="ev-description"
              name="description"
              required
              rows={3}
              maxLength={2000}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="ev-category" className="label">
              {t('events.formCategory')}
            </label>
            <select id="ev-category" name="category" className="input" defaultValue="SOCIAL">
              {HOUSE_EVENT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {t(HOUSE_EVENT_CATEGORY_LABEL_KEYS[value])}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ev-location" className="label">
              {t('events.formLocation')}
            </label>
            <input id="ev-location" name="location" maxLength={120} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ev-startsAt" className="label">
              {t('events.formStartsAt')}
            </label>
            <DateInput
              locale={locale.intlTag}
              id="ev-startsAt"
              name="startsAt"
              type="datetime-local"
              required
              className="input"
            />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary min-h-[44px] px-6">
              {t('events.submit')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-ghost min-h-[44px] px-4"
            >
              {t('action.cancel')}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
