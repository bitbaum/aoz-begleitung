'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SiteMasthead } from '@bitbaum/sitekit/react'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PublicLanguageSwitcher } from './PublicLanguageSwitcher'
import { APP_LABELS, BLOG_LABELS } from '@/lib/constants/labels'

export const PUBLIC_NAV = [
  { path: 'blog', label: 'Blog' },
  { path: 'roadmap', label: 'Roadmap' },
  { path: 'changelog', label: 'Changelog' },
]

export function PublicMasthead() {
  const pathname = usePathname()
  return (
    <>
      <SiteMasthead
        appearance="application"
        chrome={{
          name: APP_LABELS.name,
          tagline: APP_LABELS.tagline,
          footerNote: BLOG_LABELS.title,
        }}
        navItems={PUBLIC_NAV}
        currentPath={pathname.split('/')[1] ?? ''}
        Link={Link}
        mainId="public-main"
        skipLabel="Zum Inhalt springen"
        navLabel="Navigation"
        menuLabel="Menü"
        brand={<Logo size="md" />}
        actions={<Link href="/login">{BLOG_LABELS.toApp}</Link>}
      />
      <div className="bb-frame flex items-center justify-end gap-1">
        <PublicLanguageSwitcher />
        <ThemeToggle />
      </div>
    </>
  )
}
