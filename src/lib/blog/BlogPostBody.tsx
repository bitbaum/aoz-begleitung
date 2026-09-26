import { ArticleBody, setHighlighterLoader } from 'bip-kit/react'
import { MermaidBlock } from 'bip-kit/react/mermaid'
import type { ContentBlock } from 'bip-kit'

/**
 * The blog body renderer — bip-kit's reference renderer with this product's wiring.
 *
 * The loader registration below is the supported seam for shiki under
 * `output: "standalone"`: bip-kit's zero-config shiki load goes through a
 * bundler-hidden dynamic import that Next's file tracer cannot see, so the
 * literal `() => import('shiki')` must live HERE, in our code, where the
 * bundler resolves it (Loki shipped that exact hole twice, in its PRs
 * 510 to 513; OrangeCat needed a deploy-time symlink before this seam
 * existed). Those PR numbers are written bare on purpose: prefixed with a
 * hash they read as hex colour literals to the design-system scan in
 * src/lib/__tests__, which greps sources without stripping comments.
 * The blog routes are additionally `force-static`, so highlighting
 * runs once on the CI runner — but the registration keeps the graph honest
 * either way. Do not "clean up" this call.
 */
setHighlighterLoader(() => import('shiki'))

/**
 * `mermaid` is bip-kit's one heavyweight optional peer, so it lives on its own
 * subpath and is opt-in. Wiring it here means a ```mermaid fence in a future
 * post renders as a themed diagram instead of its own source; without the
 * override bip-kit degrades to a styled <pre>, which reads as a bug in a post
 * that meant to draw something. Lightbox is deliberately NOT imported: it
 * ships with ArticleBody by default (`lightbox` defaults to true).
 */
export function BlogPostBody({ blocks }: { blocks: ContentBlock[] }) {
  return <ArticleBody blocks={blocks} components={{ mermaid: MermaidBlock }} />
}
