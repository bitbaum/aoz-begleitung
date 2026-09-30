# Building in Public (AOZ)

**created_date:** 2026-08-20  
**last_modified_date:** 2026-09-30  
**last_modified_summary:** The blog reads `docs/blog/` with bip-kit 0.5's collection reader and renders typed blocks; `marked` is left for the changelog and roadmap only.

---

AOZ ships the BiP triad on the public site:

| Surface | Route | SSOT |
|---------|-------|------|
| Blog | `/blog` | `docs/blog/*.md` → bip-kit `readCollection` + typed blocks |
| Roadmap | `/roadmap` | `docs/ROADMAP.md` + `marked` |
| Changelog | `/changelog` | `CHANGELOG.md` + `marked` |

npm [`bip-kit`](https://github.com/bitbaum/bip-kit) reads the blog folder (`src/lib/blog/posts.ts`: dated file names, `# h1` titles, the `*date*` line dropped), parses it into typed blocks and renders them with no raw-HTML surface (`src/lib/blog/blocks.ts`, `BlogPostBody.tsx`). Links between repo files are rewritten before parsing (`src/lib/blog/markdown.ts`). The changelog and roadmap still render through `marked`; their input is committed markdown, never user input.

Company voice only — not resident UGC. Studio programme: Loki `docs/architecture/building-in-public-ssot.md`.
