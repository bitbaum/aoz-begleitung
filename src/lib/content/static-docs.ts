import { readFileSync } from 'fs'
import { join } from 'path'

export interface StaticDoc {
  title: string
  body: string
  /** `last_modified_date` from the doc's metadata block, when present (YYYY-MM-DD). */
  lastModified: string | null
}

/**
 * The repo docs open with a maintenance block (`created_date:`,
 * `last_modified_date:`, `last_modified_summary:`) written for the people and
 * tools that edit them. Rendered as-is it appeared on /roadmap and /changelog
 * as a paragraph of internal notes under the page header (found 2026-11-12).
 * Those lines are dropped from the public body; the date is kept for a "Stand".
 */
const METADATA_LINE = /^(created_date|last_modified_date|last_modified_summary):/

function readDoc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

function parseDoc(markdown: string): StaticDoc {
  const lines = markdown.split('\n')
  const titleIndex = lines.findIndex((line) => line.startsWith('# '))
  if (titleIndex === -1) {
    throw new Error('Static doc is missing a top-level heading.')
  }

  const rest = lines.slice(titleIndex + 1)
  const modified = rest.find((line) => line.startsWith('last_modified_date:'))

  return {
    title: lines[titleIndex].slice(2).trim(),
    body: rest
      .filter((line) => !METADATA_LINE.test(line))
      .join('\n')
      .trim(),
    lastModified: modified ? modified.slice('last_modified_date:'.length).trim() || null : null,
  }
}

export function getRoadmapDoc(): StaticDoc {
  return parseDoc(readDoc('docs/ROADMAP.md'))
}

export function getChangelogDoc(): StaticDoc {
  return parseDoc(readDoc('CHANGELOG.md'))
}
