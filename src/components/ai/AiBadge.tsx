import Link from 'next/link'
import { AI_DISCLOSURE_COPY, AI_DISCLOSURE_HREF } from '@/lib/config/ai-disclosure'

/**
 * Said wherever staff meet AI: this is AI, it is in test mode, and here is
 * exactly what it sends and to whom. One tap to the public disclosure.
 */
export function AiBadge() {
  return (
    // The LINK is the 44px hit area and the chip only its visible part: the
    // chip alone measured 20px tall, a tap target nobody could reliably hit.
    <Link
      href={AI_DISCLOSURE_HREF}
      target="_blank"
      title={AI_DISCLOSURE_COPY.badgeTitle}
      className="inline-flex min-h-[44px] items-center no-underline hover:opacity-80"
    >
      <span className="chip-info">{AI_DISCLOSURE_COPY.badge}</span>
    </Link>
  )
}
