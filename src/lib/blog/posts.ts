import { join } from 'path'
import { readCollection, type CollectionEntry } from 'bip-kit/node'

/**
 * The engineering blog, read from `docs/blog/*.md`.
 *
 * WHY THE MARKDOWN FILES ARE THE SSOT. The posts already existed as reviewed
 * files in the repo, and they are the artefact people edit. Copying them into
 * `src/content/` to make them easier to import would create a second copy that
 * drifts the first time someone fixes a typo in the wrong one. So the folder
 * stays where it is and this module reads it.
 *
 * WHY THERE IS NO FRONTMATTER. The title is the `# h1` and the date is in the
 * filename — both already load-bearing, both already conventions the folder
 * follows. Adding `title:` frontmatter would mean the title exists twice in one
 * file, which is the same drift one level down. bip-kit's collection reader
 * (`bip-kit/node`) reads exactly this shape: it takes the date from the name,
 * the title from the `# h1`, and drops the `*YYYY-MM-DD*` dateline.
 *
 * WHY THIS ONLY EVER RUNS AT BUILD TIME. The blog routes are `force-static`
 * with `dynamicParams = false`, so every page is prerendered on the CI runner,
 * where the whole repo is present. The deployed standalone bundle never reads
 * `docs/` — it serves HTML that was already rendered. Making a blog page
 * dynamic would break that quietly in production, which is why the routes pin
 * it rather than relying on Next's inference.
 */

const BLOG_DIR = join(process.cwd(), 'docs', 'blog')

export interface BlogPost {
  /** URL segment: the filename stem with the date prefix removed. */
  slug: string
  title: string
  /** ISO date, taken from the filename — the structural source. */
  date: string
  /** Markdown body, with the `# title` and the `*date*` line removed. */
  body: string
  /** First paragraph as plain text: index teaser and meta description. */
  excerpt: string
  /** The file this came from, so an error message can name it. */
  filename: string
}

/**
 * bip-kit's reader accepts looser files than this folder does (frontmatter
 * titles, undated names); the folder's own convention is enforced here so a
 * stray file fails the build instead of publishing under a made-up title.
 */
function toPost(entry: CollectionEntry): BlogPost {
  if (!entry.date || entry.meta.date || entry.meta.publishedAt) {
    throw new Error(`Blog post "${entry.file}" does not follow the YYYY-MM-DD-slug.md convention.`)
  }
  if (entry.meta.title || entry.title === entry.file.replace(/\.md$/, '')) {
    throw new Error(`Blog post "${entry.file}" has no "# Title" heading.`)
  }
  return {
    slug: entry.slug,
    title: entry.title,
    date: entry.date,
    body: entry.body.trim(),
    excerpt: entry.summary,
    filename: entry.file,
  }
}

/** Every post, newest first (ties by title). */
export function getAllPosts(): BlogPost[] {
  return readCollection(BLOG_DIR).map(toPost)
}

export function getPostBySlug(slug: string): BlogPost | null {
  return getAllPosts().find((post) => post.slug === slug) ?? null
}
