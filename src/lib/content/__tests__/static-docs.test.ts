import { getChangelogDoc, getRoadmapDoc } from '../static-docs'

/**
 * /roadmap and /changelog render these docs for the public. Their
 * maintenance block is for the people who edit them, not for readers: it
 * appeared on both pages as a paragraph of internal notes until 2026-11-12.
 */
describe.each([
  ['roadmap', getRoadmapDoc],
  ['changelog', getChangelogDoc],
])('%s as the public reads it', (_name, load) => {
  const doc = load()

  it('carries no maintenance metadata in its body', () => {
    expect(doc.body).not.toMatch(/^(created_date|last_modified_date|last_modified_summary):/m)
  })

  it('keeps the last-modified date for a "Stand" line', () => {
    expect(doc.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
