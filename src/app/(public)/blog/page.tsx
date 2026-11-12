import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPosts, BLOG_LANG } from '@/lib/blog/posts'
import { BLOG_LABELS } from '@/lib/constants/labels'
import { formatCalendarDateLong } from '@/lib/utils/formatting'

// Prerendered at build time. @see lib/blog/posts.ts for why this is not
// optional: the deployed bundle has no `docs/` folder to read.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: BLOG_LABELS.title,
  description: BLOG_LABELS.subtitle,
}

export default function BlogIndexPage() {
  const posts = getAllPosts()

  return (
    <div>
      <header className="mb-10">
        <p className="eyebrow">{BLOG_LABELS.title}</p>
        <h1 className="text-3xl sm:text-4xl font-semibold text-ui-text mt-2">
          {BLOG_LABELS.subtitle}
        </h1>
      </header>

      {posts.length === 0 ? (
        <p className="text-sm text-ui-muted">{BLOG_LABELS.empty}</p>
      ) : (
        <ul className="space-y-4">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="card-hover">
                <p className="eyebrow numeric">{formatCalendarDateLong(post.date)}</p>
                <h2 lang={BLOG_LANG} className="text-lg sm:text-xl font-semibold text-ui-text mt-1">
                  {post.title}
                </h2>
                <p lang={BLOG_LANG} className="text-sm text-ui-muted mt-2 line-clamp-3">
                  {post.excerpt}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
