// ESLint 10 flat config. `next lint` was removed in Next 16, so `npm run lint`
// now invokes the ESLint CLI directly against this file.
import { defineConfig, globalIgnores } from 'eslint/config'
import coreWebVitals from 'eslint-config-next/core-web-vitals'
import * as espree from 'espree'

export default defineConfig([
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
  ...coreWebVitals,
  {
    // eslint-config-next parses plain JS through Next's bundled Babel
    // eslint-parser, whose scope manager predates ESLint 10's
    // `scopeManager.addGlobals` contract and crashes. Espree (ESLint's own
    // parser) handles the handful of JS config files here just fine.
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    languageOptions: { parser: espree },
  },
  {
    // eslint-plugin-react's automatic React version detection still calls
    // `context.getFilename`, which ESLint 10 removed — pinning the version
    // skips detection entirely.
    settings: { react: { version: '19.2.8' } },
  },
  {
    // react-hooks v7 (bundled by eslint-config-next 16) ships two new
    // compiler-era rules as errors. The existing code uses the standard
    // pre-compiler idioms they flag (init-from-localStorage in an effect,
    // close-menu-on-pathname-change) plus one false positive (document.cookie
    // in an event handler). Surfacing them as warnings keeps the signal
    // without letting a lint-preset change block a framework lift.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  {
    // console is not a logger. `src/lib/logger.ts` is the ONE sink in this
    // repo — it redacts PII and switches to JSON in production — so app code
    // goes through it. warn/error stay allowed for what must speak before or
    // beside the logger (a boot-time failure, an unrecoverable error).
    // scripts/ is deliberately not covered: those are CLIs whose stdout IS
    // their output.
    files: ['src/**/*.{ts,tsx}'],
    rules: { 'no-console': ['error', { allow: ['warn', 'error'] }] },
  },
  {
    // The logger is the console sink; it is the one file that may call it.
    files: ['src/lib/logger.ts'],
    rules: { 'no-console': 'off' },
  },
])
