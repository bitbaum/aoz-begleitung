import { describe, expect, it } from 'vitest'
import sitemap from '../sitemap'
import robots from '../robots'
import { isPublicRoute } from '@/lib/auth/route-boundaries'
import { getAllPosts } from '@/lib/blog/posts'

/**
 * QA walk, 12 Nov 2026: robots.txt pointed to /sitemap.xml, which was 404.
 */
describe('sitemap.xml', () => {
  const entries = sitemap()
  const paths = entries.map((entry) => new URL(entry.url).pathname)

  it('lists the landing, blog, roadmap, changelog and legal pages', () => {
    for (const path of [
      '/willkommen',
      '/blog',
      '/roadmap',
      '/changelog',
      '/ki-datenschutz',
      '/datenschutz',
      '/impressum',
    ]) {
      expect(paths).toContain(path)
    }
  })

  it('lists every blog post', () => {
    for (const post of getAllPosts()) expect(paths).toContain(`/blog/${post.slug}`)
  })

  it('lists only pages a signed-out visitor can open', () => {
    // A sitemap entry that redirects to the login form is a broken promise.
    for (const path of paths) expect(isPublicRoute(path)).toBe(true)
  })

  it('uses absolute URLs, never localhost', () => {
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https?:\/\//)
      expect(entry.url).not.toContain('localhost')
    }
  })
})

describe('robots.txt', () => {
  it('points at the sitemap by absolute URL', () => {
    const { sitemap: line } = robots()
    expect(String(line)).toMatch(/^https?:\/\/[^/]+\/sitemap\.xml$/)
  })
})
