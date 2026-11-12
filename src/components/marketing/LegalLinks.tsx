import Link from 'next/link'
import { AI_DISCLOSURE_HREF } from '@/lib/config/ai-disclosure'
import { IMPRESSUM_HREF, PRIVACY_HREF } from '@/lib/config/legal'
import type { PublicLocaleId } from '@/lib/config/public-locales'
import { PUBLIC_CHROME } from '@/lib/constants/labels/public-chrome'

/**
 * Who runs this site and what it does with data, reachable from every public
 * page — not only from the ones that carry the full site footer.
 *
 * The account pages (`/login`, `/register`, …) sit on their own centred canvas
 * without `SiteFooter`, so they had no way to the Impressum or the privacy
 * statement: the one page a stranger is asked to type an email address into
 * was the one page that did not say who would receive it. This row is that
 * missing footer, in the reader's language.
 */
export function LegalLinks({
  locale,
  className = '',
}: {
  locale: PublicLocaleId
  className?: string
}) {
  const copy = PUBLIC_CHROME[locale]
  const links = [
    { href: AI_DISCLOSURE_HREF, label: copy.aiLink },
    { href: PRIVACY_HREF, label: copy.privacy },
    { href: IMPRESSUM_HREF, label: copy.impressum },
  ]

  return (
    <nav aria-label={copy.legalLabel} className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-x-4 text-xs text-ui-muted">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex items-center min-h-[44px] hover:text-ui-text underline-offset-2 hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
