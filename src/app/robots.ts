import type { MetadataRoute } from 'next'
import { publicSiteUrl } from '@/lib/config/app-url'

/**
 * robots.txt, generated so the sitemap line is an absolute URL.
 *
 * The static file said `Sitemap: /sitemap.xml` — relative, which the robots
 * standard does not accept, pointing at a sitemap that did not exist (404,
 * QA walk 12 Nov 2026). Same rules as before: the API and the resident portal
 * are not for crawlers; everything else may be read.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/portal/'] },
    sitemap: `${publicSiteUrl()}/sitemap.xml`,
  }
}
