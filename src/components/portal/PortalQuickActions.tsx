import Link from 'next/link'
import type { ComponentType } from 'react'
import { ClipboardCheck, GraduationCap, MessageSquareWarning, Settings2 } from 'lucide-react'
import { getRequestTranslator } from '@/lib/i18n/request'

interface PortalQuickActionsProps {
  pendingChoresCount: number
}

/**
 * The "Jetzt" card answers one question: what needs you right now?
 *
 * With no chores open it used to answer "Präferenzen — Nächste Aufgabe": a
 * description belonging to the chores branch, left on a card that links to a
 * settings page. So a resident with nothing to do was told a task was waiting,
 * and sent to a form to look for it. Found by reading the operator's own dashboard,
 * where the real answer is genuinely "nothing" — the demo resident always has
 * a chore, so the branch never showed up in a walkthrough.
 *
 * Saying "nothing is open" is the whole value of the card on a quiet day, and
 * it is only worth anything if it is true. Preferences stays reachable — it
 * keeps its own button in the row beside this one.
 */
export async function PortalQuickActions({ pendingChoresCount }: PortalQuickActionsProps) {
  const { t } = await getRequestTranslator()

  const primary =
    pendingChoresCount > 0
      ? {
          href: '/portal/chores',
          title: t('dashboard.quickChores'),
          description: `${pendingChoresCount} ${pendingChoresCount === 1 ? t('dashboard.taskSingular') : t('dashboard.taskPlural')}`,
          icon: ClipboardCheck,
        }
      : {
          href: '/portal/chores',
          title: t('dashboard.nothingDue'),
          description: t('dashboard.nothingDueDesc'),
          icon: ClipboardCheck,
        }

  const PrimaryIcon = primary.icon
  const secondaryActions = [
    { href: '/portal/report', label: t('dashboard.quickReport'), icon: MessageSquareWarning },
    { href: '/portal/learning', label: t('dashboard.quickLearning'), icon: GraduationCap },
    { href: '/portal/preferences', label: t('dashboard.quickPreferences'), icon: Settings2 },
  ].filter((action) => action.href !== primary.href)

  return (
    <section className="mb-8 rounded-lg border border-ui-border bg-ui-surface p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Link href={primary.href} className="group flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-primary text-ui-on-accent">
            <PrimaryIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wide text-ui-muted">
              {t('dashboard.now')}
            </span>
            <span className="mt-0.5 block font-semibold text-ui-text group-hover:text-brand-primary">
              {primary.title}
            </span>
            <span className="mt-0.5 block text-sm text-ui-muted">{primary.description}</span>
          </span>
        </Link>

        <div className="grid grid-cols-2 gap-2 md:w-auto">
          {secondaryActions.map((action) => (
            <SecondaryAction key={action.href} {...action} />
          ))}
        </div>
      </div>
    </section>
  )
}

function SecondaryAction({
  href,
  label,
  icon: Icon,
}: {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] min-w-0 items-center justify-center gap-2 rounded-md bg-ui-subtle px-3 py-2 text-sm font-medium text-ui-muted transition-colors hover:bg-ui-border hover:text-ui-text"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  )
}
