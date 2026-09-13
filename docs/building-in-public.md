# Building in Public (AOZ)

**created_date:** 2026-08-20  
**last_modified_date:** 2026-08-21  
**last_modified_summary:** Second consumer of npm `bip-kit` (replaces file: @fleetcrown/bip).

---

AOZ ships the BiP triad on the public site:

| Surface | Route | SSOT |
|---------|-------|------|
| Blog | `/blog` | `docs/blog/*.md` + `marked` |
| Roadmap | `/roadmap` | `docs/ROADMAP.md` |
| Changelog | `/changelog` | `CHANGELOG.md` |

Shared **parser / types / video allowlist**: npm [`bip-kit`](https://github.com/bitbaum/bip-kit) via `src/lib/bip.ts`. HTML rendering stays on `marked` until a full block renderer is worth the swap.

Company voice only — not resident UGC. Studio programme: Loki `docs/architecture/building-in-public-ssot.md`.
