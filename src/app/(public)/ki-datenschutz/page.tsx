import type { Metadata } from 'next'
import {
  AI_DISCLOSURE_COPY as C,
  AI_PROVIDERS_TODAY,
  AI_SURFACES,
} from '@/lib/config/ai-disclosure'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: C.pageTitle,
  description: C.pageLead,
}

/**
 * Public, account-free: anyone deciding whether to trust this product with
 * people's data can read where AI is used before they log in. Rendered from
 * config/ai-disclosure.ts, so it lists exactly the AI the code calls.
 */
export default function AiDisclosurePage() {
  return (
    <article className="max-w-none space-y-10">
      <header>
        <p className="eyebrow">Transparenz</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-ui-text">{C.pageTitle}</h1>
        <p className="mt-3 text-ui-muted max-w-2xl">{C.pageLead}</p>
      </header>

      <section aria-labelledby="ai-today">
        <h2 id="ai-today" className="text-xl font-semibold text-ui-text">
          {C.todayTitle}
        </h2>
        <p className="mt-2 text-ui-text">{C.today}</p>
        <h3 className="mt-4 text-sm font-semibold text-ui-text">{C.providersTitle}</h3>
        <ul className="mt-2 space-y-1 text-sm text-ui-text">
          {AI_PROVIDERS_TODAY.map((provider) => (
            <li key={provider.name}>
              {provider.name} ({provider.country}) — {provider.role}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ai-where">
        <h2 id="ai-where" className="text-xl font-semibold text-ui-text">
          {C.surfacesTitle}
        </h2>
        <div className="mt-3 space-y-3">
          {AI_SURFACES.map((surface) => (
            <div key={surface.source} className="card">
              <h3 className="font-semibold text-ui-text">{surface.name}</h3>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-[10rem_1fr]">
                <dt className="text-ui-muted">{C.usedByLabel}</dt>
                <dd className="text-ui-text">{surface.usedBy}</dd>
                <dt className="text-ui-muted">{C.sentLabel}</dt>
                <dd className="text-ui-text">{surface.sent}</dd>
                <dt className="text-ui-muted">{C.neverSentLabel}</dt>
                <dd className="text-ui-text">{surface.neverSent}</dd>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="ai-not">
        <h2 id="ai-not" className="text-xl font-semibold text-ui-text">
          {C.notTitle}
        </h2>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-ui-text">
          {C.not.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ai-contract">
        <h2 id="ai-contract" className="text-xl font-semibold text-ui-text">
          {C.contractTitle}
        </h2>
        <p className="mt-2 text-ui-text">{C.contract}</p>
      </section>

      <section aria-labelledby="ai-en" lang="en">
        <h2 id="ai-en" className="text-xl font-semibold text-ui-text">
          {C.englishTitle}
        </h2>
        <p className="mt-2 text-ui-text">{C.english}</p>
      </section>
    </article>
  )
}
