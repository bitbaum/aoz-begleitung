/**
 * Tab navigation components
 */

'use client'

import Link from 'next/link'

/**
 * One tab item, for all three tab components. It was written out three times
 * at `min-h-[40px]` — under the 44px floor on every filter row in the staff
 * UI (measured on /residents). One definition, so the floor is one edit.
 */
const TAB_ITEM =
  'rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-colors min-h-[44px] inline-flex items-center whitespace-nowrap'

interface Tab {
  id: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (tabId: string) => void
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-lg border border-ui-border bg-ui-surface p-1"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          id={`tab-${tab.id}`}
          aria-controls={`tabpanel-${tab.id}`}
          className={`${TAB_ITEM} ${
            activeTab === tab.id
              ? 'bg-ui-text text-ui-inverse'
              : 'text-ui-muted hover:bg-ui-subtle hover:text-ui-text'
          }`}
        >
          {/* One inline run, so the space between label and count survives:
              inside the flex item a whitespace-only text node is dropped and
              innerText read "Platziert12". */}
          <span>
            {tab.label}
            {tab.count !== undefined && (
              <>
                {' '}
                <span className="text-xs bg-ui-subtle px-2 py-0.5 rounded-md">{tab.count}</span>
              </>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}

interface TabButtonProps {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
}

export function TabButton({ children, active = false, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`${TAB_ITEM} ${
        active
          ? 'bg-ui-text text-ui-inverse'
          : 'text-ui-muted hover:bg-ui-subtle hover:text-ui-text'
      }`}
    >
      {children}
    </button>
  )
}

interface StaticTabsProps {
  children: React.ReactNode
}

export function StaticTabs({ children }: StaticTabsProps) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-lg border border-ui-border bg-ui-surface p-1"
      role="tablist"
    >
      {children}
    </div>
  )
}

// =============================================================================
// TabLink / TabLinkGroup - URL-based filter navigation (server components)
// =============================================================================

/**
 * Container for a row of `TabLink`s.
 *
 * These look like tabs but behave like navigation: every item is an `<a>` that
 * loads a new URL, and there is no tabpanel in the document that the "tab"
 * controls. Per the WAI-ARIA practices that makes them links inside a
 * navigation landmark — NOT `role="tab"` inside `role="tablist"`. Using the tab
 * roles here produced two real defects: axe `aria-required-parent` (critical,
 * `role="tab"` with no tablist ancestor) and links that no longer expose the
 * `link` role to assistive tech or `getByRole('link')`.
 */
const TAB_LINK_GROUP_STYLES = {
  boxed: 'flex gap-1 overflow-x-auto rounded-lg border border-ui-border bg-ui-surface p-1',
  underline: 'flex gap-2 overflow-x-auto border-b border-ui-border',
} as const

export function TabLinkGroup({
  label,
  variant = 'boxed',
  children,
}: {
  label: string
  variant?: keyof typeof TAB_LINK_GROUP_STYLES
  children: React.ReactNode
}) {
  return (
    <nav aria-label={label} className={TAB_LINK_GROUP_STYLES[variant]}>
      {children}
    </nav>
  )
}

interface TabLinkProps {
  href: string
  label: string
  count?: number
  active?: boolean
}

export function TabLink({ href, label, count, active = false }: TabLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`${TAB_ITEM} ${
        active
          ? 'bg-ui-text text-ui-inverse'
          : 'text-ui-muted hover:bg-ui-subtle hover:text-ui-text'
      }`}
    >
      {/* One inline run with a literal space — see Tabs above. */}
      <span>
        {label}
        {count !== undefined && (
          <>
            {' '}
            <span
              className={`rounded-md px-2 py-0.5 text-xs ${active ? 'bg-ui-inverse/10' : 'bg-ui-subtle'}`}
            >
              {count}
            </span>
          </>
        )}
      </span>
    </Link>
  )
}

// =============================================================================
// TabPanel - Content area for a tab (accessibility wrapper)
// =============================================================================

interface TabPanelProps {
  id: string
  children: React.ReactNode
  className?: string
}

export function TabPanel({ id, children, className = '' }: TabPanelProps) {
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`} className={className}>
      {children}
    </div>
  )
}
