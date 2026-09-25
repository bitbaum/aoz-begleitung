import Link from 'next/link'
import { AI_DISCLOSURE_COPY, AI_DISCLOSURE_HREF } from '@/lib/config/ai-disclosure'

/**
 * Said wherever staff meet AI: this is AI, it is in test mode, and here is
 * exactly what it sends and to whom. One tap to the public disclosure.
 */
export function AiBadge() {
  return (
    <Link
      href={AI_DISCLOSURE_HREF}
      target="_blank"
      title={AI_DISCLOSURE_COPY.badgeTitle}
      className="chip-info no-underline hover:opacity-80"
    >
      {AI_DISCLOSURE_COPY.badge}
    </Link>
  )
}
