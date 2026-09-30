/**
 * Building in Public — second studio consumer of npm `bip-kit`.
 *
 * bip-kit reads and renders the blog, changelog and roadmap (@see
 * lib/blog/posts.ts, blocks.ts). This module re-exports the
 * parser, video allowlist and roadmap·changelog types.
 * @see docs/building-in-public.md
 * @see https://github.com/bitbaum/bip-kit
 */
export {
  parseContentBlocks,
  parseFrontmatter,
  parseVideoEmbed,
  videoEmbedSrc,
  type ContentBlock,
  type ChangelogEntry,
  type RoadmapDoc,
} from 'bip-kit'
