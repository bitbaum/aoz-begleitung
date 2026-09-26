import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ArrowRightLeft } from 'lucide-react'
import { MobileNav } from '@/components/layout/MobileNav'
import { AdminUrlFeedback } from '@/components/admin/AdminUrlFeedback'
import { UserMenu } from '@/components/layout/UserMenu'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { APP_LABELS, PAGE_TITLES, ROLE_LABELS } from '@/lib/constants/labels'
import { ImpersonationBanner } from '@/components/layout/ImpersonationBanner'
import { getCurrentUser } from '@/lib/auth'
import { RESIDENT_COOKIE } from '@/lib/auth/constants'
import { visibleMegaMenuGroups, visibleSystemLinks, withInboxBadge } from '@/lib/config/navigation'
import { waitingBadgeCount } from '@/lib/inbox/waiting'

export const metadata: Metadata = {
  title: {
    template: `%s | ${APP_LABELS.name}`,
    default: APP_LABELS.name,
  },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const cookieStore = await cookies()
  const hasPortalAccess = !!cookieStore.get(RESIDENT_COOKIE)?.value

  if (!user) {
    redirect('/login')
  }

  // The one number in the navigation: people waiting on this staff member.
  // @see lib/inbox/waiting.ts
  const megaMenuGroups = withInboxBadge(visibleMegaMenuGroups(user), await waitingBadgeCount(user))
  const systemLinks = visibleSystemLinks(user)

  return (
    <>
      <AdminUrlFeedback />
      {/* Before the skip link and before the header: if this session is
          borrowed, that is the first thing on the page for a screen reader and
          for an eye, because everything below it belongs to somebody else. */}
      {user.impersonatorId && (
        <ImpersonationBanner
          viewingAsName={user.name}
          roleLabel={ROLE_LABELS[user.role] ?? user.role}
        />
      )}
      <a href="#admin-main" className="skip-link">
        Zum Inhalt springen
      </a>

      {/* The header carries IDENTITY, not destinations.
          Navigation moved into AdminSidebar: 20 destinations across 5 groups
          never fit a row, and the megamenu needed a scroll container, fade
          cues and viewport-anchored panels to pretend otherwise. What is left
          here is the brand, the theme switch and who you are signed in as —
          three things, which is what a 56px row can actually hold. */}
      <header className="chrome-bar sticky top-0 z-30 hidden md:block">
        <div className="px-6">
          <div className="flex items-center justify-between gap-6 h-14">
            <div className="flex items-center gap-6 min-w-0">
              <Logo href="/" size="md" />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle />
              {/* The role switch lives in the UserMenu, next to sign-out,
                  because switching identity is an account action — and because
                  UserMenu ALREADY renders this exact /portal link. Two controls
                  for one destination is the same defect as the old three-way
                  "Integration" menu, and this one was expensive: at 151px it
                  squeezed the primary nav below the width its own items need,
                  so on a 1280px laptop two mission areas sat behind a
                  horizontal scroll nobody finds. Measured, not guessed. */}
              <UserMenu
                user={{ name: user.name, email: user.email, role: user.role }}
                hasPortalAccess={hasPortalAccess}
                systemLinks={systemLinks}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-56px)]">
        <MobileNav groups={megaMenuGroups} systemLinks={systemLinks} />
        <AdminSidebar groups={megaMenuGroups} />
        {/* min-w-0: a flex item defaults to min-width:auto, which means it
            cannot shrink below its content's intrinsic width. Any wide child
            anywhere on an admin page — an unwrapped row, a scrollable tab
            strip, a stat grid — was pushing this ENTIRE main column wider
            than the viewport instead of being contained and clipped/scrolled
            the way each of those children already intended. */}
        <main id="admin-main" className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 p-4 pt-16 md:p-6 md:pt-6 min-w-0">{children}</div>
        </main>
      </div>

      <AdminFooter />
    </>
  )
}

/**
 * Single-line footer: the quiet brand line. Deliberately carries NO nav —
 * system destinations have exactly one home (SYSTEM_LINKS, rendered by the
 * user menu and the mobile drawer), so the footer never drifts from them.
 */
function AdminFooter() {
  return (
    <footer className="hidden md:block border-t border-ui-border bg-ui-canvas">
      <div className="max-w-screen-2xl mx-auto px-6 py-3 text-xs text-ui-muted">
        <p>
          {APP_LABELS.name} · {APP_LABELS.tagline}
        </p>
      </div>
    </footer>
  )
}
