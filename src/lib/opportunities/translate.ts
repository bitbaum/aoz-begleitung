/**
 * Producing the translations. I/O only — the rules are in `./translation.ts`.
 *
 * Called when a listing is published or changed while published. Never on a
 * resident's page load: a portal that waits on a model to render is a portal
 * that is slow exactly when the network is worst, and it would re-translate
 * the same text for every reader.
 *
 * ## Best effort, always
 *
 * Nothing here may prevent a listing from going live. A model that is down,
 * rate-limited or returning nonsense costs a resident a translation; a publish
 * that fails because of it costs every resident the listing. So every failure
 * path returns what was salvaged and logs, and the caller ignores the result.
 */

import { z } from 'zod'
import { completeText, hasAIProvider } from '@/lib/ai/provider'
import { availableLocales } from '@/lib/i18n'
import { DEFAULT_LOCALE, LOCALES, type LocaleId } from '@/lib/i18n/locales'
import { logger } from '@/lib/logger'
import { sourceHashOf, type ListingTranslations, type TranslatableListing } from './translation'

/**
 * What the model is allowed to hand back.
 *
 * Parsed rather than trusted: a model that returns a number, an object or a
 * missing title would otherwise be written into the column and rendered to a
 * resident. `requirementNote` is nullable because the German may be too.
 */
const TranslationSchema = z.object({
  title: z.string().min(1).max(400),
  description: z.string().min(1).max(4000),
  requirementNote: z.string().max(1200).nullable().optional(),
})

const MAX_TRANSLATION_TOKENS = 3000

/**
 * The languages worth translating into: the ones a resident can actually pick.
 *
 * Derived from `availableLocales()` — the same completeness rule the language
 * picker follows — rather than from LOCALE_IDS. Translating into Tigrinya
 * today would spend calls on a language nobody can select, because its
 * dictionary is unfinished and the picker therefore does not offer it. The day
 * that dictionary is completed, this follows without an edit.
 */
export function portalLocaleIds(): LocaleId[] {
  return availableLocales()
    .map((locale) => locale.id)
    .filter((id) => id !== DEFAULT_LOCALE)
}

function systemPrompt(): string {
  return [
    'Du übersetzt Ausschreibungen für Einsatzplätze, Praktika und Stellen in einem Portal für Menschen, die neu in der Schweiz sind.',
    'Übersetze den Sinn genau. Erfinde nichts dazu und lass nichts weg.',
    'Schreibe einfach: kurze Sätze, alltägliche Wörter. Die Leserin hat die Sprache vielleicht nicht studiert.',
    'Sprich die Leserin höflich an: in jeder Sprache die Höflichkeitsform (vous, Вы, Ви), nie die Du-Form — so spricht die Organisation mit ihren Klient*innen.',
    'Eigennamen, Organisationen, Orts- und Strassennamen bleiben unverändert.',
    'Ein deutscher Fachbegriff, für den es keine gute Entsprechung gibt, bleibt stehen — mit einer kurzen Erklärung in Klammern.',
    'Mach keine Aussagen über Bewilligungen, Aufenthalt oder wer arbeiten darf. Steht so etwas im Text, übersetze es wörtlich und ohne Zusatz.',
    'Antworte NUR mit JSON, ohne Text davor oder danach.',
  ].join(' ')
}

function userPrompt(listing: TranslatableListing, locale: LocaleId): string {
  return [
    `Zielsprache: ${LOCALES[locale].endonym} (${locale}).`,
    'Übersetze die folgenden Felder und antworte als JSON mit genau den Schlüsseln "title", "description", "requirementNote".',
    'Wenn "requirementNote" leer ist, gib null zurück.',
    '',
    JSON.stringify({
      title: listing.title,
      description: listing.description,
      requirementNote: listing.requirementNote,
    }),
  ].join('\n')
}

/** Models fence JSON in markdown more often than they should. */
function parseJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = (fenced ? fenced[1] : raw).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }
}

async function translateOne(
  listing: TranslatableListing,
  locale: LocaleId,
  hash: string,
): Promise<ListingTranslations | null> {
  const raw = await completeText({
    system: systemPrompt(),
    prompt: userPrompt(listing, locale),
    maxTokens: MAX_TRANSLATION_TOKENS,
    temperature: 0.2,
  })

  const parsed = TranslationSchema.safeParse(parseJson(raw))
  if (!parsed.success) {
    logger.warn('Listing translation rejected', { locale, issue: parsed.error.issues[0]?.message })
    return null
  }

  return {
    [locale]: {
      title: parsed.data.title,
      description: parsed.data.description,
      requirementNote: parsed.data.requirementNote ?? null,
      sourceHash: hash,
    },
  }
}

/**
 * Translate one listing into each locale, merging onto what is already there.
 *
 * One request per language rather than one for all of them: a single call
 * asking for six languages fails as one unit, so one bad language costs the
 * other five, and the reply is long enough to run into the token budget. Six
 * small calls fail independently, which is what "best effort" has to mean to
 * be worth anything.
 */
export async function translateListing(
  listing: TranslatableListing,
  locales: readonly LocaleId[],
  existing: ListingTranslations | null | undefined,
): Promise<ListingTranslations> {
  const merged: ListingTranslations = { ...(existing ?? {}) }
  if (!hasAIProvider() || locales.length === 0) return merged

  const hash = sourceHashOf(listing)

  const results = await Promise.allSettled(
    locales.map((locale) => translateOne(listing, locale, hash)),
  )

  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled' && result.value) {
      Object.assign(merged, result.value)
    } else if (result.status === 'rejected') {
      logger.warn('Listing translation failed', {
        locale: locales[index],
        reason: String(result.reason),
      })
    }
  }

  return merged
}
