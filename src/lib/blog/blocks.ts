import { extractToc, normalizeMarkdown, parseContentBlocks, parseInline } from 'bip-kit'
import type { ContentBlock, Inline, TocEntry } from 'bip-kit'
import { rewriteBlogLinks, rewriteRepoLinks } from './markdown'

/**
 * Repo markdown (blog posts, changelog, roadmap) → bip-kit typed blocks.
 *
 * The old pipeline was `marked` → HTML string → dangerouslySetInnerHTML. Typed
 * blocks remove that raw-HTML surface by construction: markdown becomes a
 * discriminated union and the renderer emits React elements from typed data —
 * there is no HTML passthrough for content to hide in.
 *
 * The repo-link rewrite happens on the raw markdown first, so `.md` targets
 * are already routes/GitHub URLs by the time they become link spans.
 * bip-kit has no h1 block on purpose: the title is taken from the `# h1`
 * (posts.ts, static-docs.ts) before the body ever reaches this parser.
 */
export interface ParsedPost {
  blocks: ContentBlock[]
  toc: TocEntry[]
}

/** A post body is already normalized by bip-kit's collection reader (posts.ts). */
export function parsePostBlocks(body: string): ParsedPost {
  const blocks = parseContentBlocks(rewriteBlogLinks(body))
  return { blocks, toc: extractToc(blocks) }
}

/**
 * A repo doc read straight from disk (static-docs.ts), so it gets the same
 * normalization the collection reader gives posts: wrapped bullets stay one
 * item, nested items flatten. `baseDir` is the doc's folder, for link rewriting.
 */
export function parseRepoDocBlocks(body: string, baseDir: string): ContentBlock[] {
  return parseContentBlocks(normalizeMarkdown(rewriteRepoLinks(body, baseDir)))
}

function hrefsFromSpans(spans: Inline[], into: string[]): void {
  for (const span of spans) {
    if (span.t === 'link') {
      into.push(span.href)
      hrefsFromSpans(span.children, into)
    } else if (span.t === 'strong' || span.t === 'em') {
      hrefsFromSpans(span.children, into)
    }
  }
}

/**
 * Every link href reachable from a block tree — the seam posts.test.ts uses
 * to prove no rendered post links to a `.md` file. Text-bearing blocks are
 * walked through `parseInline`, the same inline parser the renderer uses, so
 * what this collects is exactly what would render as an <a href>.
 */
export function collectLinkHrefs(blocks: ContentBlock[]): string[] {
  const hrefs: string[] = []
  const fromText = (text: string) => hrefsFromSpans(parseInline(text), hrefs)

  for (const block of blocks) {
    switch (block.type) {
      case 'h2':
      case 'h3':
      case 'h4':
      case 'p':
      case 'pullquote':
        fromText(block.text)
        break
      case 'ul':
      case 'ol':
        block.items.forEach(fromText)
        break
      case 'blockquote':
        block.text.forEach(fromText)
        break
      case 'table':
        block.headers.forEach(fromText)
        block.rows.forEach((row) => row.forEach(fromText))
        break
      case 'figure':
        if (block.caption) fromText(block.caption)
        break
      case 'callout':
      case 'footnote':
        hrefs.push(...collectLinkHrefs(block.blocks))
        break
      default:
        break
    }
  }
  return hrefs
}
