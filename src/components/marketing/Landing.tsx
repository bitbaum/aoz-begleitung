import Link from 'next/link'
import { ArrowRight, Check, X } from 'lucide-react'
import { NAV_ICONS } from '@/lib/config/navigation'
import { demoEntryHref } from '@/lib/demo/config'
import { productSurfaces } from '@/lib/config/product-surface'
import { getAllPosts } from '@/lib/blog/posts'
import { formatCalendarDateLong } from '@/lib/utils/formatting'
import { BLOG_LABELS } from '@/lib/constants/labels'
import { LOCALES } from '@/lib/i18n/locales'
import {
  marketingCopy,
  type MarketingCopy,
  type PublicLocaleId,
} from '@/lib/constants/labels/marketing'

/**
 * The landing page — what someone sees at the product's own address before
 * they have an account, in whichever language they asked for.
 *
 * WHY IT IS A COMPONENT AND NOT A PAGE. Two routes render it: `/willkommen`,
 * which is German and keeps the unprefixed URL every existing link and the
 * deploy's own probe already point at, and `/[lang]/willkommen` for the rest.
 * One component means a section added to the page cannot exist in one language
 * and be missing in another — the only thing that varies is the copy object.
 *
 * WHY THE COPY IS A PROP AND NOT A MODULE CONST. It used to be `const C =
 * MARKETING_COPY` read from module scope by all ten sections. That is fine for
 * a value fixed at build time (brand) and wrong for one that varies per request
 * (language): module scope is shared by every render, so a second language
 * could only ever be added by duplicating the file. Threading it makes the
 * dependency visible and the compiler check it.
 *
 * Prerendered: it reads brand config, the navigation and the blog folder, never
 * a session or the database. @see lib/blog/posts.ts for why that has to stay
 * true — and `(public)/layout.tsx` for why the whole group depends on it.
 */

export function Landing({ locale }: { locale: PublicLocaleId }) {
  const c = marketingCopy(locale)
  const posts = getAllPosts().slice(0, 3)

  return (
    // `lang` on the content, not on `<html>`: the root layout is shared with
    // the whole product and cannot know this route's language. Without it a
    // screen reader announces the French page with German pronunciation rules,
    // which is the difference between readable and unintelligible for the one
    // group of readers who cannot compensate by looking at it.
    <div className="-my-8 sm:-my-12" lang={LOCALES[locale].intlTag} dir={LOCALES[locale].dir}>
      <Hero c={c} />
      {/*
        WHAT IT DOES COMES BEFORE WHY IT EXISTS.

        This page used to open Hero → Problems → Steps and only reach the
        features fifth, with the full inventory sixth. A reader who wanted to
        know what the software actually contains had to get through three
        sections of prose about fragmentation first — so the product read as
        narrower than it is, and the half that is not housing (Gemeinschaft,
        Integration, Begleitung) was the half nobody scrolled to.

        `Surface` follows immediately because it is the one section that cannot
        fall behind the product: it reads the navigation, so it grows when the
        product does.
      */}
      <Features c={c} />
      <Surface c={c} locale={locale} />
      <Problems c={c} />
      <Steps c={c} />
      <Science c={c} />
      <Ethics c={c} />
      <ProductDocs c={c} />
      {posts.length > 0 && <FromTheBlog c={c} posts={posts} />}
      <Closing c={c} />
    </div>
  )
}

interface CopyProps {
  c: MarketingCopy
}

/* ── Sections ────────────────────────────────────────────────────────────── */

function Hero({ c }: CopyProps) {
  return (
    <section className="py-14 sm:py-20 border-b border-ui-border">
      <p className="eyebrow">{c.eyebrow}</p>
      <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-display text-ui-text text-balance">
        {c.headline}
      </h1>
      <p className="mt-5 text-base sm:text-lg text-ui-muted max-w-2xl leading-relaxed">
        {c.subline}
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center">
        {/* The demo is the primary action: it is the only claim on this page a
            visitor can check for themselves in one click. */}
        <Link href={demoEntryHref()} className="btn-secondary">
          {c.ctaPrimary}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <Link href="/login" className="btn-outline">
          {c.ctaSecondary}
        </Link>
      </div>
      <p className="mt-3 text-sm text-ui-muted">{c.ctaNote}</p>
    </section>
  )
}

function Problems({ c }: CopyProps) {
  return (
    <section className="py-14 sm:py-20 border-b border-ui-border">
      <p className="eyebrow">{c.problemEyebrow}</p>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text max-w-2xl text-balance">
        {c.problemTitle}
      </h2>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-px bg-ui-border border border-ui-border rounded-lg overflow-hidden">
        {c.problems.map((problem) => (
          <div key={problem.title} className="bg-ui-surface p-5">
            <h3 className="font-semibold text-ui-text">{problem.title}</h3>
            <p className="mt-2 text-sm text-ui-muted leading-relaxed">{problem.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Steps({ c }: CopyProps) {
  return (
    <section className="py-14 sm:py-20 border-b border-ui-border">
      <p className="eyebrow">{c.howEyebrow}</p>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text max-w-2xl text-balance">
        {c.howTitle}
      </h2>

      <ol className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
        {c.steps.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            {/* The number is data about position, so it gets the tabular
                treatment the rest of the product's figures get. */}
            <span className="numeric text-sm text-ui-muted pt-0.5 tabular-nums" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="border-l border-ui-border pl-4">
              <h3 className="font-semibold text-ui-text">{step.title}</h3>
              <p className="mt-1.5 text-sm text-ui-muted leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Features({ c }: CopyProps) {
  return (
    <section className="py-14 sm:py-20 border-b border-ui-border">
      <p className="eyebrow">{c.featuresEyebrow}</p>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text max-w-2xl text-balance">
        {c.featuresTitle}
      </h2>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {c.features.map((feature) => {
          const Icon = NAV_ICONS[feature.icon]
          return (
            <div key={feature.title} className="card">
              <div className="flex items-start gap-3">
                {Icon && (
                  <span className="icon-container-sm shrink-0">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                )}
                <div>
                  <h3 className="font-semibold text-ui-text">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-ui-muted leading-relaxed">{feature.body}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Science({ c }: CopyProps) {
  return (
    <section className="py-14 sm:py-20 border-b border-ui-border">
      <p className="eyebrow">{c.scienceEyebrow}</p>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text max-w-2xl text-balance">
        {c.scienceTitle}
      </h2>
      <p className="mt-4 text-ui-muted max-w-2xl leading-relaxed">{c.scienceBody}</p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-px bg-ui-border border border-ui-border rounded-lg overflow-hidden">
        {c.science.map((item) => (
          <div key={item.title} className="bg-ui-surface p-5">
            <h3 className="font-semibold text-ui-text">{item.title}</h3>
            <p className="mt-2 text-sm text-ui-muted leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Ethics({ c }: CopyProps) {
  return (
    <section className="py-14 sm:py-20 border-b border-ui-border">
      <p className="eyebrow">{c.ethicsEyebrow}</p>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text max-w-2xl text-balance">
        {c.ethicsTitle}
      </h2>
      <p className="mt-4 text-ui-muted max-w-2xl leading-relaxed">{c.ethicsBody}</p>

      <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 max-w-3xl">
        {c.neverTracked.map((item) => (
          <li key={item} className="flex items-center gap-3 py-2 border-b border-ui-border">
            {/* A crossed-out item is the message: this is a list of things the
                system refuses to hold, not a feature list. */}
            <X className="w-4 h-4 text-brand-primary shrink-0" aria-hidden="true" />
            <span className="text-sm text-ui-text line-through decoration-ui-border-strong">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FromTheBlog({ c, posts }: CopyProps & { posts: ReturnType<typeof getAllPosts> }) {
  return (
    <section className="py-14 sm:py-20 border-b border-ui-border">
      <p className="eyebrow">{c.blogEyebrow}</p>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text max-w-2xl text-balance">
        {c.blogTitle}
      </h2>

      <ul className="mt-8 space-y-3">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="card-hover">
              <p className="eyebrow numeric">{formatCalendarDateLong(post.date)}</p>
              <h3 className="mt-1 font-semibold text-ui-text">{post.title}</h3>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/blog"
        className="mt-5 inline-flex items-center gap-2 text-sm text-ui-text hover:text-brand-primary transition-colors"
      >
        {c.blogLink}
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </Link>
      <span className="sr-only">{BLOG_LABELS.title}</span>
    </section>
  )
}

/**
 * Everything the product contains, read off its own navigation.
 *
 * Nothing here is typed out. A section added to the menu appears; one removed
 * disappears. That is the whole point — the previous answer to "what is in
 * it?" was four hand-written abstractions that had been true a long time ago,
 * while the product had since grown a marketplace, house events, votes, shared
 * expenses, a learning record and a placement directory and said none of it.
 *
 * The resident column follows the reader's language; the staff column does not,
 * because the staff interface is German. `surfaceStaffNote` says so on the
 * pages where that is not self-evident — an unexplained German column on a
 * French page reads as a broken translation rather than as a fact.
 */
function Surface({ c, locale }: CopyProps & { locale: PublicLocaleId }) {
  const surfaces = productSurfaces(locale)

  return (
    <section className="py-14 sm:py-20 border-b border-ui-border">
      <p className="eyebrow">{c.surfaceEyebrow}</p>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text max-w-2xl text-balance">
        {c.surfaceTitle}
      </h2>
      <p className="mt-4 text-ui-muted max-w-2xl leading-relaxed">{c.surfaceBody}</p>
      {c.surfaceStaffNote && (
        <p className="mt-3 text-sm text-ui-muted max-w-2xl leading-relaxed">{c.surfaceStaffNote}</p>
      )}

      <div className="mt-8 space-y-8">
        {surfaces.map((surface) => (
          <div key={surface.title}>
            <h3 className="eyebrow">{surface.title}</h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-ui-border border border-ui-border rounded-lg overflow-hidden">
              {surface.areas.map((area) => (
                <div key={area.title} className="bg-ui-surface p-5">
                  <h4 className="font-semibold text-ui-text">{area.title}</h4>
                  <ul className="mt-2 space-y-1">
                    {area.entries.map((entry) => (
                      <li key={entry} className="text-sm text-ui-muted">
                        {entry}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProductDocs({ c }: CopyProps) {
  // Hrefs are structure, so they stay in the component; the words are copy, so
  // they live with the rest of the copy. They used to be a literal typed into
  // the middle of this file, three sections below a comment insisting that
  // marketing copy belongs in MARKETING_COPY.
  const hrefs = ['/roadmap', '/changelog', '/blog']

  return (
    <section className="py-14 sm:py-20 border-b border-ui-border">
      <p className="eyebrow">{c.docsEyebrow}</p>
      <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text max-w-2xl text-balance">
        {c.docsTitle}
      </h2>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {c.docs.map((doc, index) => (
          <Link key={hrefs[index]} href={hrefs[index]} className="card-hover">
            <h3 className="font-semibold text-ui-text">{doc.title}</h3>
            <p className="mt-2 text-sm text-ui-muted leading-relaxed">{doc.body}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function Closing({ c }: CopyProps) {
  return (
    <section className="py-14 sm:py-20">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text text-balance">
        {c.closingTitle}
      </h2>
      <p className="mt-3 text-ui-muted max-w-2xl leading-relaxed">{c.closingBody}</p>

      <div className="mt-7 flex flex-col sm:flex-row gap-3">
        <Link href={demoEntryHref()} className="btn-secondary">
          {c.ctaPrimary}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
        <Link href="/blog" className="btn-outline">
          {c.blogLink}
        </Link>
      </div>

      <p className="mt-8 flex items-center gap-2 text-sm text-ui-muted">
        <Check className="w-4 h-4 text-brand-secondary" aria-hidden="true" />
        {c.ctaNote}
      </p>
    </section>
  )
}
