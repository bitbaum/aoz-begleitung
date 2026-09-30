import type { Metadata } from 'next'
import Link from 'next/link'
import { getRoadmapDoc } from '@/lib/content/static-docs'
import 'bip-kit/styles.css'
import '@/lib/blog/blog.css'
import { parseRepoDocBlocks } from '@/lib/blog/blocks'
import { BlogPostBody } from '@/lib/blog/BlogPostBody'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Roadmap',
  description: 'Wohin sich das Produkt entwickelt.',
}

export default function PublicRoadmapPage() {
  const roadmap = getRoadmapDoc()

  return (
    <article className="max-w-none">
      <header className="mb-10">
        <p className="eyebrow">Produkt-Roadmap</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-ui-text">{roadmap.title}</h1>
        <p className="mt-3 text-ui-muted max-w-2xl">
          Die öffentliche Sicht auf Prioritäten, Richtung und die wissenschaftliche Grundlage hinter
          der Produktentwicklung.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/blog" className="btn-outline">
            Blog
          </Link>
          <Link href="/changelog" className="btn-outline">
            Changelog
          </Link>
        </div>
      </header>

      <BlogPostBody blocks={parseRepoDocBlocks(roadmap.body, 'docs')} />
    </article>
  )
}
