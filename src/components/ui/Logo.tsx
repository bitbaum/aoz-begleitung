import Link from 'next/link'
import { APP_LABELS } from '@/lib/constants/labels'
import { BRAND } from '@/lib/config/brand'

/**
 * The wordmark. Set as one tightly-tracked unit — the acronym carries the
 * brand colour, the product word stays neutral — so it reads as a mark rather
 * than as two words that happen to sit together.
 *
 * NOTHING here is hardcoded: both halves come from `BRAND.productName`, so
 * re-badging the product re-badges the logo. The comment used to promise this
 * about the acronym only, while the product word beside it was the literal
 * " Wohnen" — so every screen showed "AOZ Wohnen" while the page title, the
 * tab and the metadata said "AOZ Begleitung". The wordmark is the most-seen
 * string in the product, and it was the one disagreeing with the SSOT.
 *
 * @see lib/config/brand.ts
 */

type LogoSize = 'sm' | 'md' | 'lg' | 'xl'

interface LogoProps {
  size?: LogoSize
  showTagline?: boolean
  href?: string
  className?: string
}

const sizeConfig: Record<LogoSize, { mark: string; tagline: string }> = {
  sm: { mark: 'text-sm', tagline: 'text-2xs' },
  md: { mark: 'text-base', tagline: 'text-2xs' },
  lg: { mark: 'text-xl', tagline: 'text-xs' },
  xl: { mark: 'text-3xl', tagline: 'text-sm' },
}

/**
 * Split the product name into the coloured acronym and the neutral remainder.
 * Every brand names itself "<acronym> <word>"; if one ever does not, the whole
 * name simply renders neutral rather than printing a wrong acronym.
 */
function splitWordmark(productName: string, shortName: string): [string, string] {
  return productName.startsWith(`${shortName} `)
    ? [shortName, productName.slice(shortName.length)]
    : ['', productName]
}

function LogoMark({ size = 'md', showTagline = false, className = '' }: Omit<LogoProps, 'href'>) {
  const s = sizeConfig[size]
  const [mark, rest] = splitWordmark(BRAND.productName, BRAND.shortName)
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className={`font-semibold tracking-tight ${s.mark}`}>
        {mark ? <span className="text-brand-primary">{mark}</span> : null}
        <span className="text-ui-text">{rest}</span>
      </span>
      {showTagline && (
        <span className={`hidden lg:inline eyebrow ${s.tagline}`}>{APP_LABELS.tagline}</span>
      )}
    </div>
  )
}

export function Logo({ size = 'md', showTagline = false, href, className = '' }: LogoProps) {
  if (href) {
    return (
      <Link
        href={href}
        // The linked wordmark is a tap target (home), so it holds the 44px
        // floor itself — it measured 24px in the staff header.
        className={`inline-flex min-h-[44px] items-center transition-opacity hover:opacity-70 ${className}`}
        aria-label={APP_LABELS.name}
      >
        <LogoMark size={size} showTagline={showTagline} />
      </Link>
    )
  }
  return <LogoMark size={size} showTagline={showTagline} className={className} />
}
