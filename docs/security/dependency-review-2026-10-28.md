# Dependency review — 2026-10-28

The compatible dependency refresh updates Sentry within major 10 and Vitest
within major 4. Sentry's middleware-bypass advisory applies here because
`next.config.js` enables the `/monitoring` tunnel. The lock now selects Sentry
10.77.1, beyond the patched 10.75.2 floor. The application keeps its existing
monitoring configuration.

The pnpm audit before the refresh reported 31 advisories, including one
critical and 15 high. After the refresh it reports one moderate advisory,
zero high and zero critical. This is a dependency advisory review, not a
claim that every aspect of application security has been audited.

`pnpm-workspace.yaml` sets narrowly scoped security floors for vulnerable
fast-uri 3 and Vite 8 versions. Both stay inside the upstream parent packages'
supported ranges. Remove the overrides when parent minimums exclude affected
versions and the audit remains clear.

## Residual development-tool finding

- Advisory: [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99).
- Path: `drizzle-kit > @esbuild-kit/esm-loader > @esbuild-kit/core-utils > esbuild`.
- Installed affected version: esbuild 0.18.20. Fix starts at 0.25.0.
- Owner: AOZ maintainers, through the existing dependency-update workflow.
- Reason retained: the latest stable drizzle-kit at review time, 0.31.11,
  still depends on the old loader. Forcing its esbuild dependency across
  multiple incompatible 0.x versions is not a verified compatible patch.
- Exposure review: the advisory concerns esbuild's development HTTP server.
  The loader's installed implementation calls transform/transformSync, not
  serve/context. AOZ runs Next.js for its application, not an esbuild server.
  This does not establish that arbitrary future uses of the dependency are safe.
- Mitigation: do not use this transitive esbuild version as a development
  HTTP server. Keep the audit visible; no advisory has been suppressed.
- Review condition: revisit on the next drizzle-kit update or before adding
  any esbuild server use. Prefer an upstream loader removal/update and verify
  migration generation and migration execution before changing the toolchain.

Reproduce with `pnpm install --frozen-lockfile` and `pnpm audit --json`.
The lockfile is the version record; later releases may change these findings.
