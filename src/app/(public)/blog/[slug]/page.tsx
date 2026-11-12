import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReadingProgress, Toc } from 'bip-kit/react'
import 'bip-kit/styles.css'
import '@/lib/blog/blog.css'
import { BLOG_LANG, getAllPosts, getPostBySlug } from '@/lib/blog/posts'
import { parsePostBlocks } from '@/lib/blog/blocks'
import { BlogPostBody } from '@/lib/blog/BlogPostBody'
import { BLOG_LABELS } from '@/lib/constants/labels'
import { formatCalendarDateLong } from '@/lib/utils/formatting'

// Every post is prerendered from the repo at build time, and an unknown slug
// 404s from the static shell rather than trying to render on the box — where
// `docs/` does not exist. @see lib/blog/posts.ts
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      url: `/blog/${post.slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  // Trusted input becomes typed blocks: the markdown is committed to this repo
  // and reviewed in a pull request, and bip-kit's parser turns it into a
  // discriminated union with no raw-HTML surface at all. @see lib/blog/blocks.ts
  const { blocks, toc } = parsePostBlocks(post.body)

  return (
    <>
      {/* A viewport-fixed hairline showing how far into the post the reader
          is — the one piece of chrome a long read earns. */}
      <ReadingProgress />
      {/* On very wide screens the sticky scroll-spy TOC gets a rail broken out
          to the right of the reading column (the public layout is a single
          max-w-3xl column; at 2xl there are ≥384px of true viewport margin
          beside it, so the 280px breakout cannot cause horizontal scroll). The
          Toc hides itself under 3 headings, so short posts stay single-column. */}
      <div className="2xl:grid 2xl:grid-cols-[minmax(0,1fr)_240px] 2xl:gap-10 2xl:-mr-[280px]">
        <article lang={BLOG_LANG}>
          <header className="mb-8 pb-8 border-b border-ui-border">
            <p className="eyebrow numeric">
              {BLOG_LABELS.published}{' '}
              <time dateTime={post.date}>{formatCalendarDateLong(post.date)}</time>
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold text-ui-text mt-2">{post.title}</h1>
          </header>

          <BlogPostBody blocks={blocks} />

          <nav className="mt-12 pt-8 border-t border-ui-border">
            <Link href="/blog" className="btn-ghost text-sm">
              {BLOG_LABELS.backToIndex}
            </Link>
          </nav>
        </article>
        <aside className="hidden 2xl:block">
          <Toc items={toc} title={BLOG_LABELS.tocTitle} />
        </aside>
      </div>
    </>
  )
}
