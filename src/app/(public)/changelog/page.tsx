import type { Metadata } from 'next'
import Link from 'next/link'
import { getChangelogDoc } from '@/lib/content/static-docs'
import 'bip-kit/styles.css'
import '@/lib/blog/blog.css'
import { parseRepoDocBlocks } from '@/lib/blog/blocks'
import { BlogPostBody } from '@/lib/blog/BlogPostBody'
import { formatCalendarDateLong } from '@/lib/utils/formatting'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Was sich im Produkt konkret verändert hat.',
}

export default function PublicChangelogPage() {
  const changelog = getChangelogDoc()

  return (
    <article className="max-w-none">
      <header className="mb-10">
        <p className="eyebrow">Produkt-Changelog</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-ui-text">{changelog.title}</h1>
        <p className="mt-3 text-ui-muted max-w-2xl">
          Nachvollziehbare Änderungen, laufend dokumentiert. Roadmap sagt, wohin wir gehen.
          Changelog sagt, was schon da ist.
        </p>
        {changelog.lastModified ? (
          <p className="mt-3 text-sm text-ui-muted numeric">
            Stand:{' '}
            <time dateTime={changelog.lastModified}>
              {formatCalendarDateLong(changelog.lastModified)}
            </time>
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/roadmap" className="btn-outline">
            Roadmap
          </Link>
          <Link href="/blog" className="btn-outline">
            Blog
          </Link>
        </div>
      </header>

      <BlogPostBody blocks={parseRepoDocBlocks(changelog.body, '.')} />
    </article>
  )
}
