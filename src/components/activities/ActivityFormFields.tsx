import { DateInput } from '@/components/ui/DateInput'
import {
  ACTIVITY_CATEGORY_LABELS,
  ACTIVITY_COST_LABELS,
  ACTIVITY_STATUS_LABELS,
  type ActivityRecord,
} from '@/lib/config/activities'

type ActivityFormFieldsProps = {
  activity?: ActivityRecord
}

function dateInputValue(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : ''
}

export function ActivityFormFields({ activity }: ActivityFormFieldsProps) {
  return (
    <div className="space-y-5">
      {activity ? <input type="hidden" name="id" value={activity.id} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-ui-text">Titel</span>
          <input
            name="title"
            defaultValue={activity?.title}
            required
            maxLength={160}
            className="input"
          />
        </label>

        <label className="space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium text-ui-text">Beschreibung</span>
          <textarea
            name="description"
            defaultValue={activity?.description}
            required
            maxLength={2000}
            rows={5}
            className="input min-h-32"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ui-text">Kategorie</span>
          <select
            name="category"
            defaultValue={activity?.category ?? 'COMMUNITY'}
            className="input"
          >
            {Object.entries(ACTIVITY_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ui-text">Kosten</span>
          <select name="cost" defaultValue={activity?.cost ?? 'FREE'} className="input">
            {Object.entries(ACTIVITY_COST_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ui-text">Status</span>
          <select name="status" defaultValue={activity?.status ?? 'DRAFT'} className="input">
            {Object.entries(ACTIVITY_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ui-text">Kostenhinweis</span>
          <input
            name="costNote"
            defaultValue={activity?.costNote ?? ''}
            maxLength={300}
            className="input"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ui-text">Ort</span>
          <input
            name="location"
            defaultValue={activity?.location ?? ''}
            maxLength={300}
            className="input"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ui-text">Zeitplan</span>
          <input
            name="schedule"
            defaultValue={activity?.schedule ?? ''}
            maxLength={300}
            className="input"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ui-text">Webseite</span>
          <input
            name="website"
            type="url"
            defaultValue={activity?.website ?? ''}
            maxLength={500}
            className="input"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ui-text">Telefon</span>
          <input
            name="phone"
            defaultValue={activity?.phone ?? ''}
            maxLength={80}
            className="input"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ui-text">Startdatum</span>
          <DateInput
            name="startsAt"
            type="date"
            defaultValue={dateInputValue(activity?.startsAt)}
            className="input"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-ui-text">Enddatum</span>
          <DateInput
            name="endsAt"
            type="date"
            defaultValue={dateInputValue(activity?.endsAt)}
            className="input"
          />
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-md border border-ui-border bg-ui-subtle px-3 py-3">
        <input
          type="checkbox"
          name="highlight"
          value="true"
          defaultChecked={activity?.highlight ?? false}
          className="h-4 w-4 accent-brand-primary"
        />
        <span className="text-sm text-ui-text">Im Portal hervorheben</span>
      </label>
    </div>
  )
}
