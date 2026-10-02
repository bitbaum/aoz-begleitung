/**
 * Card components
 */

import Link from 'next/link'
import { getTrendColorClass, type TrendType } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return <div className={`card ${className}`}>{children}</div>
}

interface CardLinkProps extends CardProps {
  href: string
}

export function CardLink({ children, href, className = '' }: CardLinkProps) {
  return (
    <Link href={href} className={`card-hover ${className}`}>
      {children}
    </Link>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  subtitle?: string
  trend?: TrendType
  href?: string
}

export function StatCard({ label, value, subtitle, trend = 'neutral', href }: StatCardProps) {
  // Apply trend color to value if no subtitle, otherwise to subtitle
  const valueColor = !subtitle && trend !== 'neutral' ? getTrendColorClass(trend) : 'text-ui-text'

  const content = (
    <>
      <p className="eyebrow hyphens-auto">{label}</p>
      {/* `.metric` sets the number in mono with tabular figures — a row of
          stat cards has to line up, and proportional digits will not. */}
      <p className={`metric mt-3 ${valueColor}`}>{value}</p>
      {subtitle && <p className={`mt-2 text-sm ${getTrendColorClass(trend)}`}>{subtitle}</p>}
    </>
  )

  if (href) {
    return (
      <Link href={href} className="card-hover">
        {content}
      </Link>
    )
  }

  return <div className="card">{content}</div>
}

// =============================================================================
// DetailRow - For key-value display in detail pages
// =============================================================================

interface DetailRowProps {
  label: string
  value: string | React.ReactNode
}

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-ui-muted">{label}</dt>
      <dd className="text-right font-medium text-ui-text">{value}</dd>
    </div>
  )
}
