import type { ReactNode } from 'react'
import { LEGAL_LABELS, LEGAL_LAST_UPDATED, type LegalSection } from '@/lib/config/legal'

/** Turns a bare e-mail address or URL inside legal copy into a link. */
function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.-]*\w)/g).map((part, index) => {
    if (index % 2 === 0) return part
    const href = part.includes('@') && !part.startsWith('http') ? `mailto:${part}` : part
    return (
      <a key={`${part}-${index}`} href={href} className="underline">
        {part}
      </a>
    )
  })
}

interface LegalPageProps {
  eyebrow: string
  title: string
  lead: string
  sections: readonly LegalSection[]
  /** Extra content rendered inside the section with this id, after its text. */
  slots?: Record<string, ReactNode>
}

/** One shape for both legal pages: they are the same kind of thing. */
export function LegalPage({ eyebrow, title, lead, sections, slots = {} }: LegalPageProps) {
  return (
    <article className="max-w-none space-y-10">
      <header>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-ui-text">{title}</h1>
        <p className="mt-3 text-ui-muted max-w-2xl">{lead}</p>
      </header>

      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`legal-${section.id}`} className="max-w-2xl">
          <h2 id={`legal-${section.id}`} className="text-xl font-semibold text-ui-text">
            {section.title}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-ui-text">
              {linkify(paragraph)}
            </p>
          ))}
          {slots[section.id]}
        </section>
      ))}

      <p className="text-sm text-ui-muted">
        {LEGAL_LABELS.updated}: {LEGAL_LAST_UPDATED}
      </p>
    </article>
  )
}
