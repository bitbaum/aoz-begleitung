# Building in Public (AOZ)

**created_date:** 2026-08-20  
**last_modified_date:** 2026-09-30  
**last_modified_summary:** The changelog and roadmap render through bip-kit's typed blocks too (0.5.2 keeps wrapped bullets whole); `marked` and its HTML path are gone.

---

AOZ ships the BiP triad on the public site:

| Surface | Route | SSOT |
|---------|-------|------|
| Blog | `/blog` | `docs/blog/*.md` → bip-kit `readCollection` + typed blocks |
| Roadmap | `/roadmap` | `docs/ROADMAP.md` → bip-kit typed blocks |
| Changelog | `/changelog` | `CHANGELOG.md` → bip-kit typed blocks |

npm [`bip-kit`](https://github.com/bitbaum/bip-kit) reads the blog folder (`src/lib/blog/posts.ts`: dated file names, `# h1` titles, the `*date*` line dropped), parses it into typed blocks and renders them with no raw-HTML surface (`src/lib/blog/blocks.ts`, `BlogPostBody.tsx`). The changelog and roadmap (`src/lib/content/static-docs.ts`) go through the same parser and renderer via `parseRepoDocBlocks`, after bip-kit's `normalizeMarkdown` (wrapped bullets stay one item, nested items flatten). Links between repo files are rewritten before parsing, relative to each doc's folder (`src/lib/blog/markdown.ts`); `posts.test.ts` fails if any of the three surfaces links to a `.md` file or to a repo file that does not exist. No page renders raw HTML from markdown.

Company voice only — not resident UGC. Studio programme: Loki `docs/architecture/building-in-public-ssot.md`.
