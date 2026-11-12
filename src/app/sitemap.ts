import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog/posts'
import { publicSiteUrl } from '@/lib/config/app-url'
import { AI_DISCLOSURE_HREF } from '@/lib/config/ai-disclosure'
import { IMPRESSUM_HREF, PRIVACY_HREF } from '@/lib/config/legal'
import { landingPath, type PublicLocaleId } from '@/lib/config/public-locales'
import { publicLocales } from '@/lib/constants/labels/marketing'
import { LOCALES } from '@/lib/i18n/locales'

/**
 * The public pages, for search engines. robots.txt pointed here while this
 * answered 404 (QA walk, 12 Nov 2026).
 *
 * Only pages a stranger can read: the landing in every language whose copy is
 * finished (`publicLocales()`, the same list the `hreflang` tags use — an
 * unfinished language is never advertised), the blog and its posts, the
 * roadmap, the changelog and the legal pages. Sign-in pages are left out on
 * purpose: they are a door, not content anyone searches for.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicSiteUrl()
  const url = (path: string) => `${base}${path}`

  const offered = publicLocales().map((locale) => locale.id as PublicLocaleId)
  const languages = Object.fromEntries(
    offered.map((id) => [LOCALES[id].intlTag, url(landingPath(id))]),
  )
  const landings: MetadataRoute.Sitemap = offered.map((id) => ({
    url: url(landingPath(id)),
    changeFrequency: 'monthly',
    priority: 1,
    alternates: { languages },
  }))

  const pages: MetadataRoute.Sitemap = [
    '/blog',
    '/roadmap',
    '/changelog',
    AI_DISCLOSURE_HREF,
    PRIVACY_HREF,
    IMPRESSUM_HREF,
  ].map((path) => ({ url: url(path), changeFrequency: 'monthly', priority: 0.5 }))

  const posts: MetadataRoute.Sitemap = getAllPosts().map((post) => ({
    url: url(`/blog/${post.slug}`),
    lastModified: post.date,
    changeFrequency: 'yearly',
    priority: 0.4,
  }))

  return [...landings, ...pages, ...posts]
}
