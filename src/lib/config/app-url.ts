/**
 * The app's public base URL — SSOT for every absolute link the server
 * generates (email links must be absolute; relative URLs die in inboxes).
 */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
}

/**
 * Where the PUBLIC site serves, for metadata that search engines and link
 * scrapers fetch: `metadataBase`, the sitemap and robots.txt. Falls back to the
 * live host, never localhost — a sitemap full of `localhost` URLs is worse than
 * none, and the og:image had exactly that bug before `metadataBase` existed.
 */
export function publicSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://aoz.orangecat.ch').replace(/\/$/, '')
}
