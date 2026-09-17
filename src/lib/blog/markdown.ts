import { posix } from 'path'
import { Marked } from 'marked'

/**
 * Markdown rendering for the repo-linked public pages.
 *
 * Two consumers, two pipelines:
 * - The blog parses through bip-kit's typed blocks (@see ./blocks.ts) and only
 *   uses `rewriteBlogLinks` from here — typed blocks have no raw-HTML surface.
 * - Changelog and roadmap still render `marked` → HTML. Their input is
 *   markdown committed to this repository and reviewed in a pull request,
 *   never user input, so the output is trusted enough for
 *   `dangerouslySetInnerHTML`. If that content ever comes from anywhere else,
 *   this is the line that has to change first.
 */

/** Where the posts live in the repo — the default base every relative link resolves against. */
const POSTS_DIR = 'docs/blog'

/**
 * The repo is public, so a link to a file in it resolves for a web reader too.
 * Pinned to `master` rather than a commit: the post links to the *current*
 * roadmap, not the roadmap as it stood the day the post shipped.
 */
const REPO_FILE_BASE = 'https://github.com/bitbaum/aoz-begleitung/blob/master/'

/** Any link target ending in `.md`, with an optional `#fragment`. */
const MARKDOWN_LINK = /\]\(([^)\s]+\.md)(#[^)]*)?\)/g

/** A sibling post: `2026-08-14-cohabitation-os.md` → `/blog/cohabitation-os`. */
const POST_FILE = /^(?:\.\/)?\d{4}-\d{2}-\d{2}-([a-z0-9-]+)\.md$/

/**
 * Posts link the way files do — `](2026-08-14-cohabitation-os.md)`,
 * `](../ROADMAP.md)` — because they are read in the repo as often as on the
 * web. On the web every one of those is a 404 that renders as a perfectly
 * normal-looking link, so each is rewritten to something that resolves: a
 * sibling post becomes its route, any other repo file becomes its URL on
 * GitHub. Doing it here rather than editing the posts keeps both readings
 * working from one source, which is why `posts.test.ts` fails if a rendered
 * post still points at a `.md` file.
 */
function rewriteInternalLinks(markdown: string, baseDir: string): string {
  return markdown.replace(MARKDOWN_LINK, (match, target: string, hash = '') => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return match

    const post = POST_FILE.exec(target)
    if (post) return `](/blog/${post[1]}${hash})`

    const repoPath = posix.normalize(posix.join(baseDir, target))
    // A path that climbs out of the repo cannot be resolved to anything. Left
    // as it is so the gate reports it, rather than pointed at a guess.
    if (repoPath.startsWith('..')) return match

    return `](${REPO_FILE_BASE}${repoPath}${hash})`
  })
}

// A private instance: `marked`'s module-level singleton is shared process-wide,
// so configuring it globally would silently change any other caller's output.
const marked = new Marked({ gfm: true, breaks: false })

/**
 * Link rewriting for blog posts, applied to the raw markdown BEFORE bip-kit
 * parses it into blocks — so every surface a link can appear on (paragraphs,
 * list items, table cells) is covered by one pass.
 */
export function rewriteBlogLinks(markdown: string): string {
  return rewriteInternalLinks(markdown, POSTS_DIR)
}

export function renderRepoMarkdown(markdown: string, baseDir: string): string {
  return marked.parse(rewriteInternalLinks(markdown, baseDir), { async: false })
}
